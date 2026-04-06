from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Project
from app.services.transcription import run_transcription

router = APIRouter(prefix="/api/projects", tags=["transcription"])


@router.post("/{project_id}/transcribe")
async def transcribe_project(
    project_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status not in ("uploaded", "transcribed"):
        raise HTTPException(status_code=400, detail="Project cannot be transcribed in current state")
    if not project.file_path:
        raise HTTPException(status_code=400, detail="No file uploaded")

    # Update status
    project.status = "processing"
    await db.commit()

    background_tasks.add_task(run_transcription, project_id)
    return {"message": "Transcription started"}
