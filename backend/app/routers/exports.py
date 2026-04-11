"""Transcript export endpoint.

POST /api/projects/{project_id}/export
Body: { "format": "srt" | "vtt" | "txt" | "json" | "edl" }
Returns the file as an attachment stream — no on-disk persistence.
"""

from __future__ import annotations

import re
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Export, Project, Segment, Tag
from app.schemas import ExportRequest
from app.services import export_service

router = APIRouter(prefix="/api/projects/{project_id}/export", tags=["exports"])


_CONTENT_TYPES = {
    "srt": "application/x-subrip; charset=utf-8",
    "vtt": "text/vtt; charset=utf-8",
    "txt": "text/plain; charset=utf-8",
    "json": "application/json; charset=utf-8",
    "edl": "text/plain; charset=utf-8",
}


def _safe_filename(title: str, fmt: str) -> str:
    """Sanitize project title for use as an ASCII download filename."""
    base = re.sub(r"[^\w\-. ]", "_", title or "transcript").strip() or "transcript"
    return f"{base}.{fmt}"


@router.post("")
async def create_export(
    project_id: int,
    data: ExportRequest,
    db: AsyncSession = Depends(get_db),
):
    fmt = data.format.lower().strip()
    if fmt not in _CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{data.format}'. "
            f"Supported: {', '.join(sorted(_CONTENT_TYPES.keys()))}",
        )

    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    seg_result = await db.execute(
        select(Segment)
        .where(Segment.project_id == project_id)
        .order_by(Segment.segment_index)
    )
    segments = list(seg_result.scalars().all())

    if not segments:
        raise HTTPException(
            status_code=400,
            detail="Project has no transcript to export",
        )

    tags: list[Tag] = []
    if fmt in ("json", "edl"):
        tag_result = await db.execute(
            select(Tag).where(Tag.project_id == project_id).order_by(Tag.timestamp)
        )
        tags = list(tag_result.scalars().all())

    if fmt == "srt":
        body = export_service.to_srt(segments)
    elif fmt == "vtt":
        body = export_service.to_vtt(segments)
    elif fmt == "txt":
        body = export_service.to_txt(segments)
    elif fmt == "json":
        body = export_service.to_json(project, segments, tags)
    elif fmt == "edl":
        body = export_service.to_edl(project, segments, tags)
    else:  # pragma: no cover — guarded above
        raise HTTPException(status_code=400, detail="Unsupported format")

    # Record the export for audit. file_path left empty since we stream.
    db.add(Export(project_id=project_id, format=fmt, file_path=""))
    await db.commit()

    # RFC 5987 filename* for non-ASCII project titles; fallback filename for legacy clients.
    ascii_name = _safe_filename(project.title or "transcript", fmt)
    utf8_name = quote(f"{(project.title or 'transcript')}.{fmt}")
    disposition = (
        f'attachment; filename="{ascii_name}"; '
        f"filename*=UTF-8''{utf8_name}"
    )

    return Response(
        content=body,
        media_type=_CONTENT_TYPES[fmt],
        headers={"Content-Disposition": disposition},
    )
