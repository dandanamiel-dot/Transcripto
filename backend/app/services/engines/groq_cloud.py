import json
import logging
from typing import Callable

import httpx

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions"


class GroqCloudEngine:
    """Groq cloud Whisper API engine."""

    def transcribe(
        self,
        audio_path: str,
        language: str,
        on_segment: Callable[[int, dict], None] | None = None,
        api_key: str = "",
    ) -> list[dict]:
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not configured")

        logger.info(f"GroqCloud: uploading {audio_path} for transcription")

        with open(audio_path, "rb") as f:
            response = httpx.post(
                GROQ_API_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                data={
                    "model": "whisper-large-v3-turbo",
                    "language": language,
                    "response_format": "verbose_json",
                    "timestamp_granularities[]": "segment",
                },
                files={"file": (f"audio.wav", f, "audio/wav")},
                timeout=300.0,
            )

        response.raise_for_status()
        data = response.json()

        results = []
        raw_segments = data.get("segments", [])

        for i, seg in enumerate(raw_segments):
            seg_data = {
                "segment_index": i,
                "start_time": float(seg["start"]),
                "end_time": float(seg["end"]),
                "text": seg["text"].strip(),
                "confidence": seg.get("avg_logprob"),
            }
            results.append(seg_data)
            if on_segment:
                on_segment(i, seg_data)

        logger.info(f"GroqCloud: transcribed {len(results)} segments")
        return results
