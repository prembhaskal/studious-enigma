import numpy as np
import pytest

from tts import registry
import tts.parler_backend  # noqa: F401
from tts.base import VoiceConfig
from tts.parler_backend import ParlerBackend


def test_parler_registers_itself():
    registry.register("parler", ParlerBackend)
    assert "parler" in registry.available_models()


def test_parler_uses_default_description_when_missing():
    backend = ParlerBackend()
    assert backend._description(VoiceConfig())  # non-empty fallback
    assert backend._description(VoiceConfig(description="custom")) == "custom"


@pytest.mark.models
def test_parler_synthesizes_audio():
    registry.register("parler", ParlerBackend)
    backend = registry.get("parler")
    voice = VoiceConfig(description="A young Indian woman speaks clearly. Very clear recording.")
    sr, audio = backend.synthesize("नमस्ते, मेरा नाम अंजली है।", voice)
    assert isinstance(sr, int) and sr > 0
    assert isinstance(audio, np.ndarray) and audio.ndim == 1 and audio.size > 0
