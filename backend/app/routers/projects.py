import os
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Project
from app.schemas import ProjectResponse, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=ProjectResponse)
async def create_project(
    file: UploadFile = File(...),
    title: str = Form(""),
    description: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    os.makedirs(settings.upload_dir, exist_ok=True)

    # Sanitize filename
    original_name = Path(file.filename or "upload").name
    if not title:
        title = original_name.rsplit(".", 1)[0]

    # Save file
    file_path = os.path.join(settings.upload_dir, original_name)
    counter = 1
    while os.path.exists(file_path):
        stem, ext = os.path.splitext(original_name)
        file_path = os.path.join(settings.upload_dir, f"{stem}_{counter}{ext}")
        counter += 1

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    project = Project(
        title=title,
        description=description or None,
        original_filename=original_name,
        file_path=file_path,
        status="uploaded",
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int, data: ProjectUpdate, db: AsyncSession = Depends(get_db)
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}")
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Clean up files
    for path in [project.file_path, project.audio_path]:
        if path and os.path.exists(path):
            os.remove(path)

    await db.delete(project)
    await db.commit()
    return {"ok": True}
