import logging

from sqlalchemy import select

from app.database import async_session
from app.models import Project, Segment, Tag
from app.services.llm_providers import get_provider
from app.services.llm_providers.base import (
    TAG_COLORS,
    VALID_CATEGORIES,
    build_transcript_text,
)

logger = logging.getLogger(__name__)


async def run_auto_tagging(project_id: int, provider_name: str = "groq") -> list[Tag]:
    """Run AI auto-tagging on a transcribed project. Returns created Tag objects."""
    provider = get_provider(provider_name)

    async with async_session() as db:
        project = await db.get(Project, project_id)
        if not project:
            raise ValueError("Project not found")

        # Load segments
        result = await db.execute(
            select(Segment)
            .where(Segment.project_id == project_id)
            .order_by(Segment.segment_index)
        )
        segments = result.scalars().all()
        if not segments:
            raise ValueError("No segments found — transcribe the project first")

        # Build segment data for the prompt
        segments_data = [
            {
                "id": seg.id,
                "segment_index": seg.segment_index,
                "start_time": seg.start_time,
                "end_time": seg.end_time,
                "text": seg.text,
            }
            for seg in segments
        ]

        transcript_text = build_transcript_text(segments_data)

        # Set status to tagging
        project.status = "tagging"
        await db.commit()

        try:
            raw_tags = await provider.extract_tags(transcript_text, segments_data)
        except Exception:
            project.status = "transcribed"
            await db.commit()
            raise

        # Delete existing auto tags
        old_tags = await db.execute(
            select(Tag).where(
                Tag.project_id == project_id, Tag.tag_type == "auto"
            )
        )
        for old_tag in old_tags.scalars():
            await db.delete(old_tag)

        # Map and insert new tags
        max_index = len(segments_data) - 1
        created_tags: list[Tag] = []

        for raw in raw_tags:
            category = raw.get("category", "")
            if category not in VALID_CATEGORIES:
                continue

            seg_index = raw.get("segment_index")
            if not isinstance(seg_index, int) or seg_index < 0 or seg_index > max_index:
                continue

            seg = segments_data[seg_index]
            tag = Tag(
                project_id=project_id,
                segment_id=seg["id"],
                label=raw.get("label", ""),
                tag_type="auto",
                category=category,
                timestamp=seg["start_time"],
                end_timestamp=seg["end_time"],
                color=TAG_COLORS.get(category, "#8B5CF6"),
                notes=raw.get("notes"),
            )
            db.add(tag)
            created_tags.append(tag)

        project.status = "tagged"
        await db.commit()

        # Refresh to get IDs
        for tag in created_tags:
            await db.refresh(tag)

        logger.info(
            f"Auto-tagging complete for project {project_id} "
            f"with {provider_name}: {len(created_tags)} tags"
        )
        return created_tags
