from fastapi import APIRouter

from app.services.llm_providers import list_providers

router = APIRouter(prefix="/api", tags=["llm-providers"])


@router.get("/llm-providers")
async def get_llm_providers():
    return list_providers()
