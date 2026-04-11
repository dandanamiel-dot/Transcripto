"""Transcript export formatters.

Pure-Python generators for SRT, VTT, TXT, JSON, and EDL formats.
Each function takes ORM objects and returns a string (or dict for JSON).
No file I/O here — callers stream the result directly.
"""

from __future__ import annotations

import json
from typing import Iterable

from app.models import Export, Project, Segment, Tag


SCHEMA_VERSION = 1
EDL_DEFAULT_FPS = 25  # Israeli broadcast standard (PAL)


def format_timestamp(seconds: float, sep: str = ",") -> str:
    """Format seconds as HH:MM:SS<sep>mmm (SRT uses ',', VTT uses '.')."""
    if seconds < 0:
        seconds = 0.0
    total_ms = int(round(seconds * 1000))
    hours, rem = divmod(total_ms, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    secs, ms = divmod(rem, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}{sep}{ms:03d}"


def _speaker_prefix(segment: Segment) -> str:
    if segment.speaker:
        return f"[{segment.speaker}] "
    return ""


def to_srt(segments: Iterable[Segment]) -> str:
    """Generate SubRip (.srt) content."""
    lines: list[str] = []
    for i, seg in enumerate(segments, start=1):
        start = format_timestamp(seg.start_time, sep=",")
        end = format_timestamp(seg.end_time, sep=",")
        text = f"{_speaker_prefix(seg)}{seg.text.strip()}"
        lines.append(str(i))
        lines.append(f"{start} --> {end}")
        lines.append(text)
        lines.append("")
    return "\n".join(lines)


def to_vtt(segments: Iterable[Segment]) -> str:
    """Generate WebVTT (.vtt) content."""
    lines: list[str] = ["WEBVTT", ""]
    for i, seg in enumerate(segments, start=1):
        start = format_timestamp(seg.start_time, sep=".")
        end = format_timestamp(seg.end_time, sep=".")
        text = f"{_speaker_prefix(seg)}{seg.text.strip()}"
        lines.append(f"cue-{i}")
        lines.append(f"{start} --> {end}")
        lines.append(text)
        lines.append("")
    return "\n".join(lines)


def to_txt(segments: Iterable[Segment], include_timestamps: bool = False) -> str:
    """Generate plain text (.txt) content.

    Each segment on its own line. Optionally prefixed with [MM:SS] and speaker.
    """
    lines: list[str] = []
    for seg in segments:
        parts: list[str] = []
        if include_timestamps:
            total = int(seg.start_time)
            mm, ss = divmod(total, 60)
            parts.append(f"[{mm:02d}:{ss:02d}]")
        if seg.speaker:
            parts.append(f"{seg.speaker}:")
        parts.append(seg.text.strip())
        lines.append(" ".join(parts))
    return "\n".join(lines) + "\n"


def to_json(
    project: Project,
    segments: Iterable[Segment],
    tags: Iterable[Tag],
) -> str:
    """Generate a full structured JSON export (versioned schema)."""
    payload = {
        "schema_version": SCHEMA_VERSION,
        "project": {
            "id": project.id,
            "title": project.title,
            "description": project.description,
            "original_filename": project.original_filename,
            "duration_seconds": project.duration_seconds,
            "status": project.status,
            "transcription_engine": project.transcription_engine,
            "created_at": project.created_at.isoformat() if project.created_at else None,
            "updated_at": project.updated_at.isoformat() if project.updated_at else None,
        },
        "segments": [
            {
                "id": s.id,
                "index": s.segment_index,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "text": s.text,
                "confidence": s.confidence,
                "speaker": s.speaker,
            }
            for s in segments
        ],
        "tags": [
            {
                "id": t.id,
                "label": t.label,
                "tag_type": t.tag_type,
                "category": t.category,
                "timestamp": t.timestamp,
                "end_timestamp": t.end_timestamp,
                "color": t.color,
                "notes": t.notes,
                "segment_id": t.segment_id,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tags
        ],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def seconds_to_timecode(seconds: float, fps: int = EDL_DEFAULT_FPS) -> str:
    """Convert seconds to non-drop-frame SMPTE timecode HH:MM:SS:FF."""
    if seconds < 0:
        seconds = 0.0
    total_frames = int(round(seconds * fps))
    frames_per_hour = 3600 * fps
    frames_per_minute = 60 * fps
    hours, rem = divmod(total_frames, frames_per_hour)
    minutes, rem = divmod(rem, frames_per_minute)
    secs, frames = divmod(rem, fps)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}:{frames:02d}"


def to_edl(
    project: Project,
    segments: list[Segment],
    tags: list[Tag],
    fps: int = EDL_DEFAULT_FPS,
) -> str:
    """Generate a CMX 3600 EDL from tagged regions.

    One event per tag with both timestamp and a resolvable end. Tags without
    end_timestamp fall back to the parent segment's end_time, or a 5-second
    default window if neither is available. Clip name is the project title;
    each tag label is emitted as a COMMENT.
    """
    # Sort tags by start time for a deterministic EDL
    sorted_tags = sorted(
        (t for t in tags if t.timestamp is not None),
        key=lambda t: t.timestamp or 0.0,
    )

    segment_map = {s.id: s for s in segments}
    title = (project.title or "Untitled").replace("\n", " ")

    lines: list[str] = [
        f"TITLE: {title}",
        "FCM: NON-DROP FRAME",
        "",
    ]

    record_cursor = 0.0
    event_num = 1

    for tag in sorted_tags:
        src_in = float(tag.timestamp or 0.0)
        if tag.end_timestamp is not None:
            src_out = float(tag.end_timestamp)
        elif tag.segment_id and tag.segment_id in segment_map:
            src_out = float(segment_map[tag.segment_id].end_time)
        else:
            src_out = src_in + 5.0

        if src_out <= src_in:
            src_out = src_in + 1.0

        duration = src_out - src_in
        rec_in = record_cursor
        rec_out = record_cursor + duration
        record_cursor = rec_out

        event = (
            f"{event_num:03d}  AX       AAV  C        "
            f"{seconds_to_timecode(src_in, fps)} "
            f"{seconds_to_timecode(src_out, fps)} "
            f"{seconds_to_timecode(rec_in, fps)} "
            f"{seconds_to_timecode(rec_out, fps)}"
        )
        lines.append(event)
        lines.append(f"* FROM CLIP NAME: {title}")
        comment = (tag.label or "").replace("\n", " ")
        if comment:
            lines.append(f"* COMMENT: {comment}")
        lines.append("")
        event_num += 1

    return "\n".join(lines)


# Re-export for callers that want to record exports
__all__ = [
    "SCHEMA_VERSION",
    "format_timestamp",
    "seconds_to_timecode",
    "to_srt",
    "to_vtt",
    "to_txt",
    "to_json",
    "to_edl",
    "Export",  # convenience re-export for router typing
]
