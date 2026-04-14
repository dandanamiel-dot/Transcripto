from datetime import datetime

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    title: str
    description: str | None = None


class ProjectUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    speaker_names: dict[str, str] | None = None


class ProjectResponse(BaseModel):
    id: int
    title: str
    description: str | None
    original_filename: str | None
    file_path: str | None
    audio_path: str | None
    duration_seconds: float | None
    status: str
    transcription_engine: str | None
    speaker_names: dict[str, str] | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SegmentResponse(BaseModel):
    id: int
    project_id: int
    segment_index: int
    start_time: float
    end_time: float
    text: str
    confidence: float | None
    speaker: str | None

    model_config = {"from_attributes": True}


class SegmentUpdate(BaseModel):
    text: str


class TagCreate(BaseModel):
    label: str
    tag_type: str = "manual"
    category: str | None = None
    segment_id: int | None = None
    timestamp: float | None = None
    end_timestamp: float | None = None
    color: str = "#8B5CF6"
    notes: str | None = None


class TagUpdate(BaseModel):
    label: str | None = None
    category: str | None = None
    timestamp: float | None = None
    end_timestamp: float | None = None
    color: str | None = None
    notes: str | None = None


class TagResponse(BaseModel):
    id: int
    project_id: int
    segment_id: int | None
    label: str
    tag_type: str
    category: str | None
    timestamp: float | None
    end_timestamp: float | None
    color: str
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExportRequest(BaseModel):
    format: str


class DashboardStatsResponse(BaseModel):
    total_projects: int
    in_progress: int
    completed: int
    recent_projects: list[ProjectResponse]
