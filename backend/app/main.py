import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
from app.routers import (
    auto_tag,
    dashboard,
    engines,
    exports,
    llm_providers,
    media,
    projects,
    segments,
    settings as settings_router,
    tags,
    transcribe,
    ws,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Transcripto API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auto_tag.router)
app.include_router(dashboard.router)
app.include_router(engines.router)
app.include_router(exports.router)
app.include_router(llm_providers.router)
app.include_router(media.router)
app.include_router(projects.router)
app.include_router(segments.router)
app.include_router(settings_router.router)
app.include_router(tags.router)
app.include_router(transcribe.router)
app.include_router(ws.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
