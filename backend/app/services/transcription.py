import asyncio
import logging
from typing import Callable, Awaitable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.models import Project, Segment
from app.services.audio_processor import extract_audio
from app.services.diarization import assign_speakers, diarize
from app.services.engines import get_engine
from app.services.settings_store import get_api_key

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[dict], Awaitable[None]]


async def _noop_callback(event: dict):
    pass


async def _diarize_with_progress(
    project_id: int,
    project: Project,
    audio_path: str,
    db: AsyncSession,
    cb: ProgressCallback,
) -> list[dict] | None:
    """Run pyannote diarization while streaming sub-step progress to the UI
    and persisting it on the project row. Returns turns on success, or None
    on timeout / failure (already broadcast via `cb`)."""
    hf_token = await get_api_key("hf_token", db)
    loop = asyncio.get_running_loop()
    diarize_queue: asyncio.Queue[dict | None] = asyncio.Queue()

    def _on_diarize_progress(step_name: str, completed: int, total: int):
        loop.call_soon_threadsafe(
            diarize_queue.put_nowait,
            {"sub_step": step_name, "completed": completed, "total": total},
        )

    async def _diarize_thread():
        try:
            return await asyncio.to_thread(
                diarize,
                audio_path,
                hf_token,
                settings.max_speakers,
                _on_diarize_progress,
            )
        finally:
            await diarize_queue.put(None)

    diarize_task = asyncio.create_task(_diarize_thread())
    stall_seconds = settings.diarize_stall_seconds
    stalled = False

    async def _drain_progress():
        nonlocal stalled
        last_percent = -1
        last_sub: str | None = None
        while True:
            try:
                evt = await asyncio.wait_for(
                    diarize_queue.get(), timeout=stall_seconds
                )
            except asyncio.TimeoutError:
                stalled = True
                diarize_task.cancel()
                return
            if evt is None:
                return
            sub = evt["sub_step"]
            total = max(evt["total"], 1)
            percent = min(round(evt["completed"] / total * 100), 99)
            changed_sub = sub != last_sub
            enough_delta = percent - last_percent >= 5
            if changed_sub or enough_delta or percent >= 99:
                if changed_sub:
                    logger.info(
                        f"diarize[{project_id}] step={sub} "
                        f"{evt['completed']}/{evt['total']}"
                    )
                await cb(
                    {
                        "type": "diarize_progress",
                        "sub_step": sub,
                        "percent": percent,
                    }
                )
                project.progress_step = f"diarizing:{sub}"
                project.progress_current = percent
                await db.commit()
                last_sub = sub
                last_percent = percent

    drain_task = asyncio.create_task(_drain_progress())
    try:
        await drain_task
        if stalled:
            logger.warning(
                f"Diarization stalled for {stall_seconds}s "
                f"(no pyannote progress) — cancelled project {project_id}"
            )
            await cb(
                {
                    "type": "status",
                    "step": "diarize_failed",
                    "message": f"no progress for {stall_seconds}s",
                }
            )
            return None
        turns = await diarize_task
        logger.info(
            f"Diarization complete for project {project_id}: "
            f"{len(turns)} turns across "
            f"{len({t['speaker'] for t in turns})} speakers"
        )
        return turns
    except Exception as e:
        drain_task.cancel()
        logger.exception(f"Diarization failed for project {project_id}: {e}")
        await cb({"type": "status", "step": "diarize_failed", "message": str(e)})
        return None


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
    should_diarize = (
        diarize_enabled if diarize_enabled is not None else settings.enable_diarization
    )

    async with async_session() as db:
        try:
            engine, engine_api_key = await get_engine(engine_name, db)
        except ValueError as e:
            await cb({"type": "error", "message": str(e)})
            return

        project = await db.get(Project, project_id)
        if not project or not project.file_path:
            await cb({"type": "error", "message": "Project or file not found"})
            return

        try:
            # Step 1: Extract audio
            project.status = "extracting_audio"
            project.progress_step = "extracting_audio"
            project.progress_current = 0
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
            project.progress_step = "processing"
            project.progress_current = 0
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
                    engine_api_key,
                )
                await segment_queue.put(None)  # sentinel
                return result

            transcribe_task = asyncio.create_task(_transcribe())

            # Broadcast segments as they arrive
            seg_count = 0
            while True:
                seg_data = await segment_queue.get()
                if seg_data is None:
                    break
                seg_count += 1
                await cb({"type": "segment", "data": seg_data})
                # Persist progress every 5 segments so refresh can rehydrate
                if seg_count % 5 == 0:
                    project.progress_current = seg_count
                    await db.commit()

            project.progress_current = seg_count
            await db.commit()

            segments_data = await transcribe_task

            # Step 2b: Optional speaker diarization
            if should_diarize:
                project.progress_step = "diarizing"
                project.progress_current = 0
                await db.commit()
                await cb({"type": "status", "step": "diarizing"})

                turns = await _diarize_with_progress(
                    project_id, project, audio_path, db, cb
                )
                if turns:
                    assign_speakers(segments_data, turns)

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
            project.progress_step = None
            project.progress_current = None
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
            project.progress_step = None
            project.progress_current = None
            await db.commit()
            await cb({"type": "error", "message": str(e)})


async def run_diarization_only(
    project_id: int,
    progress_callback: ProgressCallback | None = None,
):
    """Background task: run speaker diarization against an already-transcribed
    project, reusing the existing audio file and segments. Updates
    `segment.speaker` in place; Whisper is not re-run."""
    cb = progress_callback or _noop_callback

    async with async_session() as db:
        project = await db.get(Project, project_id)
        if not project or not project.audio_path:
            await cb({"type": "error", "message": "Project has no audio on disk"})
            return

        result = await db.execute(
            select(Segment)
            .where(Segment.project_id == project_id)
            .order_by(Segment.segment_index)
        )
        segments = list(result.scalars().all())
        if not segments:
            await cb({"type": "error", "message": "No segments — transcribe first"})
            return

        try:
            project.progress_step = "diarizing"
            project.progress_current = 0
            await db.commit()
            await cb({"type": "status", "step": "diarizing"})

            turns = await _diarize_with_progress(
                project_id, project, project.audio_path, db, cb
            )

            if turns:
                segments_view = [
                    {
                        "id": s.id,
                        "start_time": s.start_time,
                        "end_time": s.end_time,
                    }
                    for s in segments
                ]
                assign_speakers(segments_view, turns)
                by_id = {s["id"]: s.get("speaker") for s in segments_view}
                for seg in segments:
                    seg.speaker = by_id.get(seg.id)
                # A fresh diarization invalidates any custom speaker renames
                # the user set under the previous run.
                project.speaker_names = None

            project.progress_step = None
            project.progress_current = None
            await db.commit()

            await cb(
                {
                    "type": "complete",
                    "segment_count": len(segments),
                }
            )

        except Exception as e:
            logger.exception(f"Re-diarization failed for project {project_id}")
            project.progress_step = None
            project.progress_current = None
            await db.commit()
            await cb({"type": "error", "message": str(e)})
