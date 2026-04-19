import json
import logging

import httpx

from app.services.llm_providers.base import SYSTEM_PROMPT, build_transcript_text

logger = logging.getLogger(__name__)

API_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4o-mini"


class OpenAITaggingProvider:
    async def extract_tags(
        self, api_key: str, transcript_text: str, segments: list[dict]
    ) -> list[dict]:
        user_message = f"Transcript segments:\n{transcript_text}"

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_message},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.3,
                    "max_tokens": 4096,
                },
            )
            resp.raise_for_status()

        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        return parsed.get("tags", [])
