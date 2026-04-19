from typing import Protocol


def format_time(seconds: float) -> str:
    m = int(seconds) // 60
    s = int(seconds) % 60
    return f"{m:02d}:{s:02d}"


TAG_COLORS: dict[str, str] = {
    "quote": "#8B5CF6",
    "topic_change": "#F59E0B",
    "emotion": "#EF4444",
    "keyword": "#3B82F6",
    "name_place": "#10B981",
}

VALID_CATEGORIES = set(TAG_COLORS.keys())

SYSTEM_PROMPT = """\
You are a transcript analysis assistant for Hebrew-language journalism interviews.
Analyze the transcript below and extract structured tags in these categories:

- quote: Notable direct quotes worth highlighting
- topic_change: Points where the conversation topic shifts
- emotion: Segments with strong emotional content (anger, sadness, excitement, etc.)
- keyword: Important terms, concepts, or recurring themes
- name_place: People's names, organization names, and geographic locations mentioned

For each tag, provide:
- label: A short descriptive label (in Hebrew, matching the transcript language)
- category: One of [quote, topic_change, emotion, keyword, name_place]
- segment_index: The 0-based index of the segment this tag relates to
- notes: Optional brief explanation (in Hebrew)

Return a JSON object with a single key "tags" containing an array of tag objects.
Only return tags you are confident about. Aim for 10-30 tags for a typical interview.
"""

TAG_TOOL_SCHEMA = {
    "name": "save_tags",
    "description": "Save the extracted tags from the transcript analysis.",
    "input_schema": {
        "type": "object",
        "properties": {
            "tags": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string", "description": "Short descriptive label in Hebrew"},
                        "category": {
                            "type": "string",
                            "enum": ["quote", "topic_change", "emotion", "keyword", "name_place"],
                        },
                        "segment_index": {"type": "integer", "description": "0-based segment index"},
                        "notes": {"type": "string", "description": "Optional explanation in Hebrew"},
                    },
                    "required": ["label", "category", "segment_index"],
                },
            }
        },
        "required": ["tags"],
    },
}


def build_transcript_text(segments: list[dict]) -> str:
    lines = []
    for seg in segments:
        start = format_time(seg["start_time"])
        end = format_time(seg["end_time"])
        lines.append(f"[{seg['segment_index']}] ({start}-{end}) {seg['text']}")
    return "\n".join(lines)


class TaggingProvider(Protocol):
    async def extract_tags(
        self, api_key: str, transcript_text: str, segments: list[dict]
    ) -> list[dict]:
        """Send transcript to LLM, return list of tag dicts.

        Each dict has: label, category, segment_index, notes (optional).
        """
        ...
