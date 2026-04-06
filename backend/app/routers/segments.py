from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Segment
from app.schemas import SegmentResponse, SegmentUpdate

router = APIRouter(prefix="/api/projects/{project_id}/segments", tags=["segments"])


@router.get("", response_model=list[SegmentResponse])
async def list_segments(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Segment)
        .where(Segment.project_id == project_id)
        .order_by(Segment.segment_index)
    )
    return result.scalars().all()


@router.put("/{segment_id}", response_model=SegmentResponse)
async def update_segment(
    project_id: int,
    segment_id: int,
    data: SegmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    segment = await db.get(Segment, segment_id)
    if not segment or segment.project_id != project_id:
        raise HTTPException(status_code=404, detail="Segment not found")

    segment.text = data.text
    await db.commit()
    await db.refresh(segment)
    return segment
