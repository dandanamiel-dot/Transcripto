from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Project, Tag
from app.schemas import TagCreate, TagResponse, TagUpdate

router = APIRouter(prefix="/api/projects/{project_id}/tags", tags=["tags"])


@router.get("", response_model=list[TagResponse])
async def list_tags(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Tag).where(Tag.project_id == project_id).order_by(Tag.timestamp)
    )
    return result.scalars().all()


@router.post("", response_model=TagResponse)
async def create_tag(
    project_id: int, data: TagCreate, db: AsyncSession = Depends(get_db)
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tag = Tag(project_id=project_id, **data.model_dump())
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


@router.put("/{tag_id}", response_model=TagResponse)
async def update_tag(
    project_id: int,
    tag_id: int,
    data: TagUpdate,
    db: AsyncSession = Depends(get_db),
):
    tag = await db.get(Tag, tag_id)
    if not tag or tag.project_id != project_id:
        raise HTTPException(status_code=404, detail="Tag not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tag, field, value)

    await db.commit()
    await db.refresh(tag)
    return tag


@router.delete("/{tag_id}")
async def delete_tag(
    project_id: int, tag_id: int, db: AsyncSession = Depends(get_db)
):
    tag = await db.get(Tag, tag_id)
    if not tag or tag.project_id != project_id:
        raise HTTPException(status_code=404, detail="Tag not found")

    await db.delete(tag)
    await db.commit()
    return {"ok": True}
