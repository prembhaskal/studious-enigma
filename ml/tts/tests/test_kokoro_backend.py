import numpy as np
import pytest

from tts import registry
import tts.kokoro_backend  # noqa: F401  (registers "kokoro")
from tts.base import VoiceConfig


def test_kokoro_registers_itself():
    from tts.kokoro_backend import KokoroBackend

    registry.register("kokoro", KokoroBackend)
    assert "kokoro" in registry.available_models()


def test_lang_code_for_voice():
    from tts.kokoro_backend import KokoroBackend

    assert KokoroBackend._lang_code("hf_alpha") == "h"
    assert KokoroBackend._lang_code("af_heart") == "a"
    assert KokoroBackend._lang_code(None) == "a"


@pytest.mark.models
def test_kokoro_synthesizes_audio():
    from tts.kokoro_backend import KokoroBackend

    registry.register("kokoro", KokoroBackend)
    backend = registry.get("kokoro")
    sr, audio = backend.synthesize("नमस्ते, आप कैसे हैं?", VoiceConfig(voice_id="hf_alpha"))
    assert sr == 24000
    assert isinstance(audio, np.ndarray)
    assert audio.ndim == 1
    assert audio.size > 0
