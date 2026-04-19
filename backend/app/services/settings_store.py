"""Resolver for user-editable API keys.

Keys live in the `app_settings` table and are edited from the settings UI.
When a key is not set in the DB we fall back to the value from `.env` via
pydantic `Settings`, so a developer who already has keys in `.env` keeps
working without any UI action.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import AppSetting


@dataclass(frozen=True)
class ApiKeyDefinition:
    name: str  # stable id, also the column name in `settings`
    label: str
    label_he: str
    # getter onto `settings` for env fallback
    env_attr: str


API_KEY_DEFINITIONS: list[ApiKeyDefinition] = [
    ApiKeyDefinition(
        name="groq_api_key",
        label="Groq",
        label_he="Groq",
        env_attr="groq_api_key",
    ),
    ApiKeyDefinition(
        name="openai_api_key",
        label="OpenAI",
        label_he="OpenAI",
        env_attr="openai_api_key",
    ),
    ApiKeyDefinition(
        name="anthropic_api_key",
        label="Anthropic",
        label_he="Anthropic",
        env_attr="anthropic_api_key",
    ),
    ApiKeyDefinition(
        name="hf_token",
        label="Hugging Face (diarization)",
        label_he="Hugging Face (זיהוי דוברים)",
        env_attr="hf_token",
    ),
]

_BY_NAME: dict[str, ApiKeyDefinition] = {d.name: d for d in API_KEY_DEFINITIONS}


def _env_value(name: str) -> str:
    """Read the `.env` fallback for a key name, or empty string."""
    defn = _BY_NAME.get(name)
    if not defn:
        return ""
    return getattr(settings, defn.env_attr, "") or ""


async def _db_value(name: str, db: AsyncSession) -> str:
    row = await db.get(AppSetting, name)
    if row is None:
        return ""
    return row.value or ""


async def get_api_key(name: str, db: AsyncSession) -> str:
    """Return the live API key for `name`. DB wins; falls back to `.env`."""
    if name not in _BY_NAME:
        raise ValueError(f"Unknown API key: {name}")
    value = await _db_value(name, db)
    if value:
        return value
    return _env_value(name)


async def set_api_key(name: str, value: str, db: AsyncSession) -> None:
    """Upsert an API key. Empty string clears the DB row so the `.env`
    fallback (if any) becomes visible again."""
    if name not in _BY_NAME:
        raise ValueError(f"Unknown API key: {name}")
    value = (value or "").strip()

    row = await db.get(AppSetting, name)
    if not value:
        if row is not None:
            await db.delete(row)
        await db.commit()
        return

    if row is None:
        row = AppSetting(key=name, value=value)
        db.add(row)
    else:
        row.value = value
    await db.commit()


def _mask(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 4:
        return "•" * len(value)
    return "•" * 4 + value[-4:]


async def list_api_keys_status(db: AsyncSession) -> list[dict]:
    """For the settings UI: one entry per known key with is_set + masked
    preview. Plaintext is never returned."""
    # Single round-trip for all rows.
    result = await db.execute(select(AppSetting))
    db_rows = {row.key: row.value for row in result.scalars().all()}

    items: list[dict] = []
    for defn in API_KEY_DEFINITIONS:
        db_val = db_rows.get(defn.name, "") or ""
        env_val = _env_value(defn.name)
        active = db_val or env_val
        items.append(
            {
                "name": defn.name,
                "label": defn.label,
                "label_he": defn.label_he,
                "is_set": bool(active),
                "masked": _mask(active),
                "source": "db" if db_val else ("env" if env_val else None),
            }
        )
    return items
