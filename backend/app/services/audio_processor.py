import os
import subprocess

from app.config import settings


def extract_audio(input_path: str, project_id: int) -> tuple[str, float]:
    """Extract audio from video/audio file to WAV 16kHz mono. Returns (audio_path, duration_seconds)."""
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
    subprocess.run(cmd, capture_output=True, check=True)

    # Get duration
    probe_cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        output_path,
    ]
    result = subprocess.run(probe_cmd, capture_output=True, text=True, check=True)
    duration = float(result.stdout.strip())

    return output_path, duration
