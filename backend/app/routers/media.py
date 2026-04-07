import os

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from app.database import get_db
from app.models import Project

router = APIRouter(prefix="/api/projects", tags=["media"])


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

    file_size = os.path.getsize(audio_path)
    range_header = request.headers.get("range")

    if range_header:
        # Parse Range: bytes=start-end
        range_spec = range_header.replace("bytes=", "")
        parts = range_spec.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if parts[1] else file_size - 1
        end = min(end, file_size - 1)
        length = end - start + 1

        with open(audio_path, "rb") as f:
            f.seek(start)
            data = f.read(length)

        return Response(
            content=data,
            status_code=206,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(length),
                "Content-Type": "audio/wav",
            },
        )

    return FileResponse(
        audio_path,
        media_type="audio/wav",
        headers={"Accept-Ranges": "bytes"},
    )
