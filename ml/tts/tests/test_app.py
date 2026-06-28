import os

import pytest

import app
from tts import registry, presets
from tests.fakes import FakeBackend


@pytest.fixture
def fake_kokoro_preset(monkeypatch):
    # Register a fake under the preset's model name so generate() stays offline.
    preset = presets.presets_for("kokoro")[0]
    registry.register(preset.model, FakeBackend)
    return preset


def test_resolve_voice_uses_preset(fake_kokoro_preset):
    model, voice = app.resolve_voice(fake_kokoro_preset.label, None)
    assert model == "kokoro"
    assert voice.voice_id == fake_kokoro_preset.voice.voice_id


def test_resolve_voice_override_replaces_voice_id_for_kokoro(fake_kokoro_preset):
    _model, voice = app.resolve_voice(fake_kokoro_preset.label, "hm_omega")
    assert voice.voice_id == "hm_omega"


def test_resolve_voice_override_replaces_description_for_parler():
    p = presets.presets_for("parler")[0]
    _model, voice = app.resolve_voice(p.label, "a calm narrator")
    assert voice.description == "a calm narrator"


def test_generate_writes_unique_file_and_echoes_name(tmp_path, fake_kokoro_preset, monkeypatch):
    monkeypatch.setattr(app, "OUTPUT_DIR", str(tmp_path))
    audio_path, file_path, status = app.generate("hello", fake_kokoro_preset.label, None)

    # audio player and download both point at the saved file
    assert audio_path == file_path
    assert file_path.endswith(".wav")
    assert os.path.exists(file_path)

    # unique, timestamped name (not the old fixed out.wav), echoed in the status
    filename = os.path.basename(file_path)
    assert filename.startswith("tts-kokoro-")
    assert filename != "out.wav"
    assert filename in status


def test_generate_filenames_do_not_collide(tmp_path, fake_kokoro_preset, monkeypatch):
    monkeypatch.setattr(app, "OUTPUT_DIR", str(tmp_path))
    _a1, p1, _s1 = app.generate("one", fake_kokoro_preset.label, None)
    _a2, p2, _s2 = app.generate("two", fake_kokoro_preset.label, None)
    assert p1 != p2  # each generation gets its own file (no clobbering)


def test_generate_empty_text_raises():
    import gradio as gr

    with pytest.raises(gr.Error):
        app.generate("   ", presets.presets()[0].label, None)
