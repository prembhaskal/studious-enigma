import pytest

from tts import presets
from tts.base import VoiceConfig


def test_presets_are_nonempty_and_well_formed():
    items = presets.presets()
    assert len(items) >= 3
    for p in items:
        assert p.label
        assert p.model in {"parler", "kokoro"}
        assert isinstance(p.voice, VoiceConfig)


def test_parler_presets_carry_a_description():
    for p in presets.presets_for("parler"):
        assert p.voice.description


def test_kokoro_presets_carry_a_voice_id():
    for p in presets.presets_for("kokoro"):
        assert p.voice.voice_id


def test_by_label_roundtrip_and_missing():
    first = presets.presets()[0]
    assert presets.by_label(first.label) is first
    with pytest.raises(KeyError):
        presets.by_label("no such preset")
