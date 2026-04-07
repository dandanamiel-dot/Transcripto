from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import dashboard, engines, media, projects, segments, tags, transcribe, ws


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

app.include_router(dashboard.router)
app.include_router(engines.router)
app.include_router(media.router)
app.include_router(projects.router)
app.include_router(segments.router)
app.include_router(tags.router)
app.include_router(transcribe.router)
app.include_router(ws.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
