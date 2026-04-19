from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.engines import list_engines

router = APIRouter(prefix="/api", tags=["engines"])


@router.get("/engines")
async def get_engines(db: AsyncSession = Depends(get_db)):
    return await list_engines(db)
