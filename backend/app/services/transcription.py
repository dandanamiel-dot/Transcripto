import asyncio
import logging

from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models import Project, Segment
from app.services.audio_processor import extract_audio

logger = logging.getLogger(__name__)


def _transcribe_with_whisper(audio_path: str, language: str) -> list[dict]:
    """Run faster-whisper transcription synchronously."""
    from faster_whisper import WhisperModel

    model = WhisperModel(settings.whisper_model, device="cpu", compute_type="int8")
    segments_iter, info = model.transcribe(audio_path, language=language, beam_size=5)

    results = []
    for i, seg in enumerate(segments_iter):
        results.append({
            "segment_index": i,
            "start_time": seg.start,
            "end_time": seg.end,
            "text": seg.text.strip(),
            "confidence": seg.avg_log_prob,
        })

    return results


async def run_transcription(project_id: int):
    """Background task: extract audio, transcribe, save segments."""
    async with async_session() as db:
        project = await db.get(Project, project_id)
        if not project or not project.file_path:
            return

        try:
            # Step 1: Extract audio
            project.status = "extracting_audio"
            await db.commit()

            audio_path, duration = await asyncio.to_thread(
                extract_audio, project.file_path, project_id
            )
            project.audio_path = audio_path
            project.duration_seconds = duration
            await db.commit()

            # Step 2: Transcribe
            project.status = "processing"
            await db.commit()

            segments_data = await asyncio.to_thread(
                _transcribe_with_whisper, audio_path, settings.default_language
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
            project.transcription_engine = "faster-whisper"
            await db.commit()

            logger.info(f"Transcription complete for project {project_id}: {len(segments_data)} segments")

        except Exception:
            logger.exception(f"Transcription failed for project {project_id}")
            project.status = "uploaded"
            await db.commit()
