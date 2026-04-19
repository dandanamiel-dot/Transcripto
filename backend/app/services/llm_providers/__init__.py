from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.llm_providers.base import TaggingProvider
from app.services.llm_providers.anthropic_provider import AnthropicTaggingProvider
from app.services.llm_providers.groq_provider import GroqTaggingProvider
from app.services.llm_providers.openai_provider import OpenAITaggingProvider
from app.services.settings_store import get_api_key


@dataclass(frozen=True)
class ProviderDef:
    engine: TaggingProvider
    label: str
    label_he: str
    key_name: str  # name in settings_store (e.g. "groq_api_key")


PROVIDER_REGISTRY: dict[str, ProviderDef] = {
    "groq": ProviderDef(
        engine=GroqTaggingProvider(),
        label="Groq (Llama 3.3)",
        label_he="Groq (Llama 3.3)",
        key_name="groq_api_key",
    ),
    "openai": ProviderDef(
        engine=OpenAITaggingProvider(),
        label="OpenAI (GPT-4o mini)",
        label_he="OpenAI (GPT-4o mini)",
        key_name="openai_api_key",
    ),
    "anthropic": ProviderDef(
        engine=AnthropicTaggingProvider(),
        label="Anthropic (Claude)",
        label_he="Anthropic (Claude)",
        key_name="anthropic_api_key",
    ),
}


async def get_provider(
    name: str, db: AsyncSession
) -> tuple[TaggingProvider, str]:
    """Resolve a provider + its live API key. Raises ValueError if the
    provider is unknown or its key is not configured."""
    defn = PROVIDER_REGISTRY.get(name)
    if defn is None:
        raise ValueError(f"Unknown LLM provider: {name}")
    key = await get_api_key(defn.key_name, db)
    if not key:
        raise ValueError(f"Provider '{name}' is not available (missing API key)")
    return defn.engine, key


async def list_providers(db: AsyncSession) -> list[dict]:
    """Return providers with availability computed from the live API keys."""
    out: list[dict] = []
    for name, defn in PROVIDER_REGISTRY.items():
        key = await get_api_key(defn.key_name, db)
        out.append(
            {
                "name": name,
                "label": defn.label,
                "label_he": defn.label_he,
                "available": bool(key),
            }
        )
    return out
