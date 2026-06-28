"""Common interface for all TTS backends."""
from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np


@dataclass
class VoiceConfig:
    """How a backend should voice the text.

    Backends use the fields they support and ignore the rest, so new fields
    (e.g. speed, pitch) can be added without breaking existing backends.
    """

    description: str | None = None  # Parler: free-text voice description
    voice_id: str | None = None     # Kokoro: fixed voice id
    speed: float | None = None      # future / per-backend optional
    pitch: float | None = None      # future / per-backend optional


class TTSBackend(ABC):
    """A swappable text-to-speech model."""

    name: str = ""

    @abstractmethod
    def load(self) -> None:
        """Load weights into memory. Idempotent; may download on first call."""

    @abstractmethod
    def synthesize(self, text: str, voice: VoiceConfig) -> tuple[int, np.ndarray]:
        """Return (sample_rate, mono float32 audio)."""
