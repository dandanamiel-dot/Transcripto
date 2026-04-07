import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

# In-memory progress channels: project_id → set of asyncio.Queue
_channels: dict[int, set[asyncio.Queue]] = {}


def get_progress_callback(project_id: int):
    """Return an async callback that broadcasts events to all WS clients for a project."""

    async def callback(event: dict):
        queues = _channels.get(project_id, set())
        for q in queues:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass

    return callback


@router.websocket("/api/ws/transcription/{project_id}")
async def transcription_ws(websocket: WebSocket, project_id: int):
    await websocket.accept()

    queue: asyncio.Queue = asyncio.Queue(maxsize=200)

    # Register
    if project_id not in _channels:
        _channels[project_id] = set()
    _channels[project_id].add(queue)

    try:
        while True:
            event = await queue.get()
            await websocket.send_text(json.dumps(event, ensure_ascii=False))
            # If complete or error, close after sending
            if event.get("type") in ("complete", "error"):
                break
    except WebSocketDisconnect:
        pass
    finally:
        _channels[project_id].discard(queue)
        if not _channels[project_id]:
            del _channels[project_id]
