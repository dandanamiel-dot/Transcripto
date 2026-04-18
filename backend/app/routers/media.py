import os

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.database import get_db
from app.models import Project

router = APIRouter(prefix="/api/projects", tags=["media"])

VIDEO_EXTENSIONS = {
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
}


def _serve_range(file_path: str, media_type: str, request: Request) -> Response:
    """Serve a file with HTTP Range support. Mirrors browser media streaming needs."""
    file_size = os.path.getsize(file_path)
    range_header = request.headers.get("range")

    if range_header:
        range_spec = range_header.replace("bytes=", "")
        parts = range_spec.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if parts[1] else file_size - 1
        end = min(end, file_size - 1)
        length = end - start + 1

        with open(file_path, "rb") as f:
            f.seek(start)
            data = f.read(length)

        return Response(
            content=data,
            status_code=206,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(length),
                "Content-Type": media_type,
            },
        )

    return FileResponse(
        file_path,
        media_type=media_type,
        headers={"Accept-Ranges": "bytes"},
    )


@router.get("/{project_id}/audio")
async def stream_audio(
    project_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project or not project.audio_path:
        raise HTTPException(status_code=404, detail="Audio not found")

    audio_path = project.audio_path
    if not os.path.isfile(audio_path):
        raise HTTPException(status_code=404, detail="Audio file missing")

    return _serve_range(audio_path, "audio/wav", request)


@router.get("/{project_id}/video")
async def stream_video(
    project_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project or not project.file_path:
        raise HTTPException(status_code=404, detail="Source file not found")

    src = project.file_path
    if not os.path.isfile(src):
        raise HTTPException(status_code=404, detail="Source file missing on disk")

    ext = os.path.splitext(src)[1].lower()
    media_type = VIDEO_EXTENSIONS.get(ext)
    if media_type is None:
        raise HTTPException(status_code=415, detail="Source is not a video file")

    return _serve_range(src, media_type, request)
