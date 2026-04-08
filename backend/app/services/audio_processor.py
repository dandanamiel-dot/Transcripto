import logging
import os
import shutil
import subprocess

from app.config import settings

logger = logging.getLogger(__name__)


def extract_audio(input_path: str, project_id: int) -> tuple[str, float]:
    """Extract audio from video/audio file to WAV 16kHz mono. Returns (audio_path, duration_seconds)."""
    # Check that ffmpeg is available
    if not shutil.which("ffmpeg"):
        raise RuntimeError(
            "ffmpeg is not installed. Install it with: brew install ffmpeg"
        )

    os.makedirs(settings.audio_dir, exist_ok=True)
    output_path = os.path.join(settings.audio_dir, f"project_{project_id}.wav")

    cmd = [
        "ffmpeg",
        "-i", input_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        "-y",
        output_path,
    ]
    try:
        subprocess.run(cmd, capture_output=True, check=True)
    except subprocess.CalledProcessError as e:
        stderr = e.stderr.decode(errors="replace") if e.stderr else ""
        logger.error("ffmpeg failed: %s", stderr)
        raise RuntimeError(f"ffmpeg audio extraction failed: {stderr[:500]}") from e

    # Get duration
    probe_cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        output_path,
    ]
    try:
        result = subprocess.run(probe_cmd, capture_output=True, text=True, check=True)
        duration = float(result.stdout.strip())
    except (subprocess.CalledProcessError, ValueError) as e:
        logger.warning("ffprobe failed, defaulting duration to 0: %s", e)
        duration = 0.0

    return output_path, duration
