from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.engines.base import TranscriptionEngine
from app.services.engines.groq_cloud import GroqCloudEngine
from app.services.engines.whisper_local import WhisperLocalEngine
from app.services.settings_store import get_api_key


@dataclass(frozen=True)
class EngineDef:
    engine: TranscriptionEngine
    label: str
    label_he: str
    # Optional key name in settings_store; None = no key required (local engines).
    key_name: str | None = None


ENGINE_REGISTRY: dict[str, EngineDef] = {
    "faster-whisper": EngineDef(
        engine=WhisperLocalEngine(model_name="large-v3"),
        label="Whisper (large-v3)",
        label_he="Whisper מקומי",
    ),
    "ivrit-ai": EngineDef(
        engine=WhisperLocalEngine(model_name="ivrit-ai/whisper-large-v3-ct2"),
        label="ivrit-ai large-v3 (Hebrew)",
        label_he="ivrit-ai large-v3 (עברית)",
    ),
    "ivrit-ai-turbo": EngineDef(
        engine=WhisperLocalEngine(model_name="ivrit-ai/whisper-large-v3-turbo-ct2"),
        label="ivrit-ai Turbo (Hebrew)",
        label_he="ivrit-ai טורבו (עברית)",
    ),
    "groq": EngineDef(
        engine=GroqCloudEngine(),
        label="Groq Cloud",
        label_he="Groq ענן",
        key_name="groq_api_key",
    ),
}


async def get_engine(
    name: str, db: AsyncSession
) -> tuple[TranscriptionEngine, str]:
    """Resolve an engine + the API key it should use (empty string for local)."""
    defn = ENGINE_REGISTRY.get(name)
    if defn is None:
        raise ValueError(f"Unknown engine: {name}")
    key = ""
    if defn.key_name:
        key = await get_api_key(defn.key_name, db)
        if not key:
            raise ValueError(f"Engine '{name}' is not available (missing API key)")
    return defn.engine, key


async def list_engines(db: AsyncSession) -> list[dict]:
    out: list[dict] = []
    for name, defn in ENGINE_REGISTRY.items():
        if defn.key_name is None:
            available = True
        else:
            key = await get_api_key(defn.key_name, db)
            available = bool(key)
        out.append(
            {
                "name": name,
                "label": defn.label,
                "label_he": defn.label_he,
                "available": available,
            }
        )
    return out
