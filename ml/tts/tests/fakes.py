"""Test doubles used by offline unit tests."""
import numpy as np

from tts.base import TTSBackend, VoiceConfig


class FakeBackend(TTSBackend):
    name = "fake"

    def __init__(self):
        self.load_calls = 0
        self.last_voice: VoiceConfig | None = None

    def load(self) -> None:
        self.load_calls += 1

    def synthesize(self, text: str, voice: VoiceConfig) -> tuple[int, np.ndarray]:
        self.last_voice = voice
        return 16000, np.zeros(1600, dtype=np.float32)
