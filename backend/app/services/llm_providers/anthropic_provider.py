import json
import logging

import httpx

from app.services.llm_providers.base import SYSTEM_PROMPT, TAG_TOOL_SCHEMA

logger = logging.getLogger(__name__)

API_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-4-20250514"


class AnthropicTaggingProvider:
    async def extract_tags(
        self, api_key: str, transcript_text: str, segments: list[dict]
    ) -> list[dict]:
        user_message = f"Transcript segments:\n{transcript_text}\n\nAnalyze the transcript and call the save_tags tool with the extracted tags."

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                API_URL,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "max_tokens": 4096,
                    "system": SYSTEM_PROMPT,
                    "tools": [TAG_TOOL_SCHEMA],
                    "tool_choice": {"type": "tool", "name": "save_tags"},
                    "messages": [
                        {"role": "user", "content": user_message},
                    ],
                },
            )
            resp.raise_for_status()

        data = resp.json()
        # Extract tool_use block from the response
        for block in data.get("content", []):
            if block.get("type") == "tool_use" and block.get("name") == "save_tags":
                tool_input = block.get("input", {})
                return tool_input.get("tags", [])

        return []
