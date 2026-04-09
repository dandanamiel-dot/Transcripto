from app.services.engines.base import TranscriptionEngine
from app.services.engines.whisper_local import WhisperLocalEngine
from app.services.engines.groq_cloud import GroqCloudEngine
from app.config import settings

# Engine registry: name → (engine_instance, display_label, requires_key)
ENGINES: dict[str, dict] = {
    "faster-whisper": {
        "engine": WhisperLocalEngine(model_name="large-v3"),
        "label": "Whisper (large-v3)",
        "label_he": "Whisper מקומי",
        "available": True,
    },
    "ivrit-ai": {
        "engine": WhisperLocalEngine(model_name="ivrit-ai/whisper-large-v3-ct2"),
        "label": "ivrit-ai large-v3 (Hebrew)",
        "label_he": "ivrit-ai large-v3 (עברית)",
        "available": True,
    },
    "ivrit-ai-turbo": {
        "engine": WhisperLocalEngine(model_name="ivrit-ai/whisper-large-v3-turbo-ct2"),
        "label": "ivrit-ai Turbo (Hebrew)",
        "label_he": "ivrit-ai טורבו (עברית)",
        "available": True,
    },
    "groq": {
        "engine": GroqCloudEngine(),
        "label": "Groq Cloud",
        "label_he": "Groq ענן",
        "available": bool(settings.groq_api_key),
    },
}


def get_engine(name: str) -> TranscriptionEngine:
    entry = ENGINES.get(name)
    if not entry:
        raise ValueError(f"Unknown engine: {name}")
    if not entry["available"]:
        raise ValueError(f"Engine '{name}' is not available (missing API key)")
    return entry["engine"]


def list_engines() -> list[dict]:
    return [
        {
            "name": name,
            "label": info["label"],
            "label_he": info["label_he"],
            "available": info["available"],
        }
        for name, info in ENGINES.items()
    ]
