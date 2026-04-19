from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Project
from app.routers.ws import get_progress_callback
from app.services.engines import ENGINE_REGISTRY
from app.services.settings_store import get_api_key
from app.services.transcription import run_diarization_only, run_transcription

router = APIRouter(prefix="/api/projects", tags=["transcription"])


@router.post("/{project_id}/transcribe")
async def transcribe_project(
    project_id: int,
    background_tasks: BackgroundTasks,
    engine: str = Query(default="faster-whisper"),
    diarize: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status not in ("uploaded", "transcribed"):
        raise HTTPException(
            status_code=400, detail="Project cannot be transcribed in current state"
        )
    if not project.file_path:
        raise HTTPException(status_code=400, detail="No file uploaded")

    # Validate engine
    engine_def = ENGINE_REGISTRY.get(engine)
    if not engine_def:
        raise HTTPException(status_code=400, detail=f"Unknown engine: {engine}")
    if engine_def.key_name:
        key = await get_api_key(engine_def.key_name, db)
        if not key:
            raise HTTPException(
                status_code=400, detail=f"Engine '{engine}' is not available"
            )

    # Update status
    project.status = "processing"
    await db.commit()

    progress_callback = get_progress_callback(project_id)
    background_tasks.add_task(
        run_transcription, project_id, progress_callback, engine, diarize
    )
    return {
        "message": "Transcription started",
        "engine": engine,
        "diarize": diarize,
    }


@router.post("/{project_id}/diarize")
async def diarize_project(
    project_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Re-run diarization only, reusing existing audio + segments."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status not in ("transcribed", "tagged", "reviewed", "completed"):
        raise HTTPException(
            status_code=400,
            detail=f"Project must be transcribed first (current: {project.status})",
        )
    if not project.audio_path:
        raise HTTPException(status_code=400, detail="No audio on disk")
    if project.progress_step and project.progress_step.startswith("diarizing"):
        raise HTTPException(
            status_code=409,
            detail="Diarization is already running for this project",
        )

    hf_token = await get_api_key("hf_token", db)
    if not hf_token:
        raise HTTPException(
            status_code=400,
            detail="Hugging Face token is not configured",
        )

    progress_callback = get_progress_callback(project_id)
    background_tasks.add_task(
        run_diarization_only, project_id, progress_callback
    )
    return {"message": "Diarization started"}
