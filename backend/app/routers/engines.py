from fastapi import APIRouter

from app.services.engines import list_engines

router = APIRouter(prefix="/api", tags=["engines"])


@router.get("/engines")
async def get_engines():
    return list_engines()
