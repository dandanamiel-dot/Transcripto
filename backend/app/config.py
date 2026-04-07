from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./storage/transcripto.db"
    upload_dir: str = "./storage/uploads"
    audio_dir: str = "./storage/audio"
    default_language: str = "he"
    whisper_model: str = "large-v3"
    groq_api_key: str = ""
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
