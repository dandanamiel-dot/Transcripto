from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Project
from app.routers.ws import get_progress_callback
from app.services.engines import ENGINES
from app.services.transcription import run_transcription

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
    engine_info = ENGINES.get(engine)
    if not engine_info:
        raise HTTPException(status_code=400, detail=f"Unknown engine: {engine}")
    if not engine_info["available"]:
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
