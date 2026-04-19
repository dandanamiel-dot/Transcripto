"""Speaker diarization using pyannote.audio.

Runs after transcription. Assigns each Whisper segment to the speaker with
the greatest temporal overlap in the diarization result.

The pyannote pipeline is loaded lazily (first call only) and cached on the
module, since the model download is large (~500MB) and model init is slow.
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

ProgressFn = Callable[[str, int, int], None]

_pipeline = None
_pipeline_error: Optional[str] = None


def _load_pipeline(hf_token: str):
    """Lazy-load the pyannote speaker-diarization-3.1 pipeline.

    Returns the pipeline or raises RuntimeError with a friendly message.
    Caches success for the process lifetime.
    """
    global _pipeline, _pipeline_error
    if _pipeline is not None:
        return _pipeline
    if _pipeline_error is not None:
        raise RuntimeError(_pipeline_error)

    try:
        from pyannote.audio import Pipeline  # type: ignore
    except ImportError as e:
        _pipeline_error = (
            "pyannote.audio is not installed. Run "
            "'pip install pyannote.audio==3.3.2' in the backend venv."
        )
        raise RuntimeError(_pipeline_error) from e

    if not hf_token:
        raise RuntimeError(
            "HF_TOKEN is not set. Create a Hugging Face access token and "
            "accept the license for pyannote/speaker-diarization-3.1."
        )

    try:
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=hf_token,
        )
    except Exception as e:
        _pipeline_error = f"Failed to load pyannote pipeline: {e}"
        logger.exception("Failed to load pyannote pipeline")
        raise RuntimeError(_pipeline_error) from e

    # On Apple Silicon, the default CPU path takes 1–2h for a 60-min audio.
    # MPS (Metal) is ~5–10x faster. Fall back silently if MPS isn't built
    # or if any op in the pipeline refuses to move — we'd rather run slow
    # than crash mid-diarization.
    try:
        import torch

        if torch.backends.mps.is_available() and torch.backends.mps.is_built():
            pipeline = pipeline.to(torch.device("mps"))
            logger.info("pyannote pipeline moved to MPS")
        else:
            logger.info("pyannote pipeline staying on CPU (MPS unavailable)")
    except Exception:
        logger.exception("Could not move pyannote to MPS — staying on CPU")

    _pipeline = pipeline
    return pipeline


def diarize(
    audio_path: str,
    hf_token: str,
    max_speakers: int = 6,
    on_progress: Optional[ProgressFn] = None,
) -> list[dict]:
    """Run diarization on a WAV file and return a list of speaker turns.

    Each item: {"start": float, "end": float, "speaker": "SPEAKER_00"}
    Callers are responsible for running this inside asyncio.to_thread.

    If `on_progress` is given, it is called on pipeline sub-step updates as
    `on_progress(step_name, completed, total)`. The callback runs on the
    worker thread — the caller is responsible for marshaling it back to the
    event loop (e.g. `loop.call_soon_threadsafe`).
    """
    pipeline = _load_pipeline(hf_token)

    def _hook(
        step_name: str,
        step_artifact: Any,
        file: Optional[dict] = None,
        total: Optional[int] = None,
        completed: Optional[int] = None,
    ) -> None:
        if on_progress is None:
            return
        c = int(completed) if completed is not None else 0
        t = int(total) if total is not None else 1
        try:
            on_progress(step_name, c, t)
        except Exception:
            logger.exception("diarize on_progress callback failed")

    logger.info(f"diarize: starting pipeline on {audio_path} (max_speakers={max_speakers})")
    diarization = pipeline(audio_path, hook=_hook, max_speakers=max_speakers)

    turns: list[dict] = []
    for turn, _track, speaker in diarization.itertracks(yield_label=True):
        turns.append(
            {
                "start": float(turn.start),
                "end": float(turn.end),
                "speaker": str(speaker),
            }
        )
    return turns


def assign_speakers(
    segments: list[dict],
    diarization_turns: list[dict],
) -> list[dict]:
    """Assign a speaker label to each transcription segment.

    For each segment pick the diarization turn with maximum temporal overlap.
    Mutates each segment dict by adding a "speaker" key and returns the same
    list for chaining.
    """
    if not diarization_turns:
        return segments

    for seg in segments:
        s_start = float(seg.get("start_time", 0.0))
        s_end = float(seg.get("end_time", 0.0))
        if s_end <= s_start:
            seg["speaker"] = None
            continue

        best_speaker: Optional[str] = None
        best_overlap = 0.0
        for turn in diarization_turns:
            overlap_start = max(s_start, turn["start"])
            overlap_end = min(s_end, turn["end"])
            overlap = overlap_end - overlap_start
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = turn["speaker"]
        seg["speaker"] = best_speaker

    return segments
