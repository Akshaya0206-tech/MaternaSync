"""Real local speech-to-text via faster-whisper (CTranslate2), run entirely
on-device — no audio or transcript ever leaves the machine. The model is
loaded lazily on first use and cached as a module-level singleton so
repeated consultations don't pay the load cost every time.

Honest by construction: on any decode/inference failure this raises
TranscriptionError rather than returning empty or guessed text, so the
caller can show "Transcription could not be completed." instead of
silently fabricating a transcript.
"""

from pathlib import Path
from threading import Lock

_model = None
_model_lock = Lock()

WHISPER_MODEL_SIZE = "base"


class TranscriptionError(Exception):
    pass


def _get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from faster_whisper import WhisperModel
                _model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
    return _model


def transcribe_audio(file_path: Path) -> str:
    """Runs the audio file through Whisper and returns the plain-text
    transcript. Raises TranscriptionError on any failure — never returns
    partial or invented text."""
    try:
        model = _get_model()
        segments, _info = model.transcribe(str(file_path), language="en")
        text = " ".join(segment.text.strip() for segment in segments).strip()
        return text
    except Exception as exc:
        raise TranscriptionError(str(exc)) from exc
