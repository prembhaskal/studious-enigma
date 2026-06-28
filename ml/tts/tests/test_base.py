import numpy as np
import pytest

from tts.base import TTSBackend, VoiceConfig
from tests.fakes import FakeBackend


def test_voice_config_defaults_are_none():
    cfg = VoiceConfig()
    assert cfg.description is None
    assert cfg.voice_id is None
    assert cfg.speed is None
    assert cfg.pitch is None


def test_ttsbackend_is_abstract():
    with pytest.raises(TypeError):
        TTSBackend()  # cannot instantiate abstract class


def test_fake_backend_synthesize_returns_sr_and_float32_array():
    backend = FakeBackend()
    backend.load()
    sr, audio = backend.synthesize("hello", VoiceConfig(voice_id="x"))
    assert sr == 16000
    assert isinstance(audio, np.ndarray)
    assert audio.dtype == np.float32
    assert audio.ndim == 1
    assert backend.last_voice.voice_id == "x"
