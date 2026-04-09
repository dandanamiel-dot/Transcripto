from app.config import settings
from app.services.llm_providers.base import TaggingProvider
from app.services.llm_providers.groq_provider import GroqTaggingProvider
from app.services.llm_providers.openai_provider import OpenAITaggingProvider
from app.services.llm_providers.anthropic_provider import AnthropicTaggingProvider

LLM_PROVIDERS: dict[str, dict] = {
    "groq": {
        "engine": GroqTaggingProvider(),
        "label": "Groq (Llama 3.3)",
        "label_he": "Groq (Llama 3.3)",
        "available": bool(settings.groq_api_key),
    },
    "openai": {
        "engine": OpenAITaggingProvider(),
        "label": "OpenAI (GPT-4o mini)",
        "label_he": "OpenAI (GPT-4o mini)",
        "available": bool(settings.openai_api_key),
    },
    "anthropic": {
        "engine": AnthropicTaggingProvider(),
        "label": "Anthropic (Claude)",
        "label_he": "Anthropic (Claude)",
        "available": bool(settings.anthropic_api_key),
    },
}


def get_provider(name: str) -> TaggingProvider:
    entry = LLM_PROVIDERS.get(name)
    if not entry:
        raise ValueError(f"Unknown LLM provider: {name}")
    if not entry["available"]:
        raise ValueError(f"Provider '{name}' is not available (missing API key)")
    return entry["engine"]


def list_providers() -> list[dict]:
    return [
        {
            "name": name,
            "label": info["label"],
            "label_he": info["label_he"],
            "available": info["available"],
        }
        for name, info in LLM_PROVIDERS.items()
    ]
