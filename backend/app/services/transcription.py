import asyncio
import logging
from typing import Callable, Awaitable

from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models import Project, Segment
from app.services.audio_processor import extract_audio
from app.services.engines import get_engine

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[dict], Awaitable[None]]


async def _noop_callback(event: dict):
    pass


async def run_transcription(
    project_id: int,
    progress_callback: ProgressCallback | None = None,
    engine_name: str = "faster-whisper",
):
    """Background task: extract audio, transcribe with selected engine, save segments."""
    cb = progress_callback or _noop_callback
    engine = get_engine(engine_name)

    async with async_session() as db:
        project = await db.get(Project, project_id)
        if not project or not project.file_path:
            await cb({"type": "error", "message": "Project or file not found"})
            return

        try:
            # Step 1: Extract audio
            project.status = "extracting_audio"
            await db.commit()
            await cb({"type": "status", "step": "extracting_audio"})

            audio_path, duration = await asyncio.to_thread(
                extract_audio, project.file_path, project_id
            )
            project.audio_path = audio_path
            project.duration_seconds = duration
            await db.commit()

            # Step 2: Transcribe with selected engine
            project.status = "processing"
            await db.commit()
            await cb({"type": "status", "step": "processing"})

            live_segments: list[dict] = []

            def on_segment(index: int, seg_data: dict):
                live_segments.append(seg_data)

            segments_data = await asyncio.to_thread(
                engine.transcribe,
                audio_path,
                settings.default_language,
                on_segment,
            )

            # Broadcast collected segments
            for seg_data in live_segments:
                await cb({"type": "segment", "data": seg_data})

            # Step 3: Save segments (clear old ones first)
            old_segments = await db.execute(
                select(Segment).where(Segment.project_id == project_id)
            )
            for seg in old_segments.scalars():
                await db.delete(seg)

            for seg_data in segments_data:
                db.add(Segment(project_id=project_id, **seg_data))

            project.status = "transcribed"
            project.transcription_engine = engine_name
            await db.commit()

            await cb(
                {
                    "type": "complete",
                    "segment_count": len(segments_data),
                }
            )

            logger.info(
                f"Transcription complete for project {project_id} "
                f"with {engine_name}: {len(segments_data)} segments"
            )

        except Exception as e:
            logger.exception(f"Transcription failed for project {project_id}")
            project.status = "uploaded"
            await db.commit()
            await cb({"type": "error", "message": str(e)})
