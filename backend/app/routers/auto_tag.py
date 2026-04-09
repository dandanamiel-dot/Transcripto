import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Project
from app.schemas import TagResponse
from app.services.auto_tagger import run_auto_tagging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["auto-tag"])


@router.post("/{project_id}/auto-tag", response_model=list[TagResponse])
async def auto_tag_project(
    project_id: int,
    provider: str = Query(default="groq"),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.status not in ("transcribed", "tagged", "reviewed", "completed"):
        raise HTTPException(
            status_code=400,
            detail=f"Project must be transcribed first (current status: {project.status})",
        )

    try:
        tags = await run_auto_tagging(project_id, provider)
        return tags
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Auto-tagging failed for project {project_id}")
        raise HTTPException(status_code=500, detail=f"Auto-tagging failed: {str(e)}")
