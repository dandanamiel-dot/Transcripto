import asyncio
import logging
from typing import Callable, Awaitable

from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models import Project, Segment
from app.services.audio_processor import extract_audio
from app.services.diarization import assign_speakers, diarize
from app.services.engines import get_engine

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[dict], Awaitable[None]]


async def _noop_callback(event: dict):
    pass


async def run_transcription(
    project_id: int,
    progress_callback: ProgressCallback | None = None,
    engine_name: str = "faster-whisper",
    diarize_enabled: bool | None = None,
):
    """Background task: extract audio, transcribe with selected engine, save segments.

    If diarize_enabled is True (or None and settings.enable_diarization is True),
    a speaker diarization pass runs after transcription and populates segment.speaker.
    """
    cb = progress_callback or _noop_callback
    engine = get_engine(engine_name)
    should_diarize = (
        diarize_enabled if diarize_enabled is not None else settings.enable_diarization
    )

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
            await cb({"type": "status", "step": "processing", "duration": duration})

            # Use a queue so segments are broadcast in real-time from the
            # background thread, rather than batched after completion.
            segment_queue: asyncio.Queue[dict | None] = asyncio.Queue()
            loop = asyncio.get_running_loop()

            def on_segment(index: int, seg_data: dict):
                loop.call_soon_threadsafe(segment_queue.put_nowait, seg_data)

            # Run transcription in a thread; when done put a sentinel.
            async def _transcribe():
                result = await asyncio.to_thread(
                    engine.transcribe,
                    audio_path,
                    settings.default_language,
                    on_segment,
                )
                await segment_queue.put(None)  # sentinel
                return result

            transcribe_task = asyncio.create_task(_transcribe())

            # Broadcast segments as they arrive
            while True:
                seg_data = await segment_queue.get()
                if seg_data is None:
                    break
                await cb({"type": "segment", "data": seg_data})

            segments_data = await transcribe_task

            # Step 2b: Optional speaker diarization
            if should_diarize:
                await cb({"type": "status", "step": "diarizing"})
                try:
                    turns = await asyncio.to_thread(
                        diarize, audio_path, settings.hf_token
                    )
                    assign_speakers(segments_data, turns)
                    logger.info(
                        f"Diarization complete for project {project_id}: "
                        f"{len(turns)} turns across "
                        f"{len({t['speaker'] for t in turns})} speakers"
                    )
                except Exception as e:
                    # Non-fatal — keep the transcript, skip speaker labels.
                    logger.exception(
                        f"Diarization failed for project {project_id}: {e}"
                    )
                    await cb(
                        {
                            "type": "status",
                            "step": "diarize_failed",
                            "message": str(e),
                        }
                    )

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
