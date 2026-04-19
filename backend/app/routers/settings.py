from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.settings_store import (
    list_api_keys_status,
    set_api_key,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])


class ApiKeyUpdate(BaseModel):
    value: str


@router.get("/api-keys")
async def list_api_keys(db: AsyncSession = Depends(get_db)):
    return await list_api_keys_status(db)


@router.put("/api-keys/{name}")
async def update_api_key(
    name: str,
    body: ApiKeyUpdate,
    db: AsyncSession = Depends(get_db),
):
    try:
        await set_api_key(name, body.value, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"ok": True}
