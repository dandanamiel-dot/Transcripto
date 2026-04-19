from typing import Callable, Protocol


class TranscriptionEngine(Protocol):
    """Protocol for transcription engines."""

    def transcribe(
        self,
        audio_path: str,
        language: str,
        on_segment: Callable[[int, dict], None] | None = None,
        api_key: str = "",
    ) -> list[dict]:
        """Transcribe an audio file and return a list of segment dicts.

        Each dict has: segment_index, start_time, end_time, text, confidence.
        on_segment is called synchronously after each segment is transcribed.
        `api_key` is ignored by local engines; cloud engines (e.g. Groq) use it.
        """
        ...
