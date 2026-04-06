from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Project
from app.schemas import DashboardStatsResponse, ProjectResponse

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

IN_PROGRESS_STATUSES = {"extracting_audio", "processing", "tagging"}


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    # Total
    total = await db.scalar(select(func.count(Project.id)))

    # In progress
    in_progress = await db.scalar(
        select(func.count(Project.id)).where(Project.status.in_(IN_PROGRESS_STATUSES))
    )

    # Completed
    completed = await db.scalar(
        select(func.count(Project.id)).where(Project.status == "completed")
    )

    # Recent projects
    result = await db.execute(
        select(Project).order_by(Project.created_at.desc()).limit(6)
    )
    recent = result.scalars().all()

    return DashboardStatsResponse(
        total_projects=total or 0,
        in_progress=in_progress or 0,
        completed=completed or 0,
        recent_projects=[ProjectResponse.model_validate(p) for p in recent],
    )
