import logging
from typing import Callable

from app.config import settings

logger = logging.getLogger(__name__)


class WhisperLocalEngine:
    """Local faster-whisper engine. Supports any HuggingFace-compatible model."""

    def __init__(self, model_name: str = "large-v3"):
        self.model_name = model_name

    def transcribe(
        self,
        audio_path: str,
        language: str,
        on_segment: Callable[[int, dict], None] | None = None,
    ) -> list[dict]:
        from faster_whisper import WhisperModel

        logger.info(f"WhisperLocal: loading model {self.model_name}")
        model = WhisperModel(self.model_name, device="cpu", compute_type="int8")
        segments_iter, info = model.transcribe(
            audio_path, language=language, beam_size=5
        )

        results = []
        for i, seg in enumerate(segments_iter):
            seg_data = {
                "segment_index": i,
                "start_time": seg.start,
                "end_time": seg.end,
                "text": seg.text.strip(),
                "confidence": seg.avg_logprob,
            }
            results.append(seg_data)
            if on_segment:
                on_segment(i, seg_data)

        logger.info(
            f"WhisperLocal: transcribed {len(results)} segments with {self.model_name}"
        )
        return results
