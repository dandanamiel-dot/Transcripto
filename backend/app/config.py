from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./storage/transcripto.db"
    upload_dir: str = "./storage/uploads"
    audio_dir: str = "./storage/audio"
    default_language: str = "he"
    whisper_model: str = "large-v3"
    groq_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    hf_token: str = ""  # Hugging Face access token for pyannote.audio
    enable_diarization: bool = False  # default off; per-job flag overrides
    max_speakers: int = 6  # cap for pyannote speaker detection
    diarize_timeout_seconds: int = 1800  # soft cap; on timeout, transcript saves without speakers
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
