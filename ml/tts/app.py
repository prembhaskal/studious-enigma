"""Gradio web UI for the local text-to-speech app."""
import dataclasses
import logging
import os
import time
import uuid

import gradio as gr

from tts import output, presets, registry
from tts.base import VoiceConfig

# Importing the backends registers them with the registry.
import tts.kokoro_backend  # noqa: F401
import tts.parler_backend  # noqa: F401

logger = logging.getLogger(__name__)

OUTPUT_DIR = "outputs"


def resolve_voice(preset_label: str, advanced_override: str | None) -> tuple[str, VoiceConfig]:
    preset = presets.by_label(preset_label)
    voice = dataclasses.replace(preset.voice)  # copy so we don't mutate the preset
    override = (advanced_override or "").strip()
    if override:
        if preset.model == "parler":
            voice = dataclasses.replace(voice, description=override)
        else:  # kokoro
            voice = dataclasses.replace(voice, voice_id=override)
    return preset.model, voice


def generate(text: str, preset_label: str, advanced_override: str | None):
    if not text or not text.strip():
        raise gr.Error("Please enter some text to synthesize.")

    model_name, voice = resolve_voice(preset_label, advanced_override)
    logger.info("generate: model=%s preset=%r chars=%d", model_name, preset_label, len(text))
    try:
        backend = registry.get(model_name)  # first call loads/downloads the model
        start = time.perf_counter()
        sr, audio = backend.synthesize(text, voice)
        elapsed = time.perf_counter() - start
    except Exception as exc:  # surface load/synthesis failures in the UI
        logger.exception("synthesis failed for model %s", model_name)
        raise gr.Error(f"Synthesis failed for model '{model_name}': {exc}")

    duration = len(audio) / sr if sr else 0.0
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filename = f"tts-{model_name}-{time.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:4]}.wav"
    path = output.save_wav(sr, audio, os.path.join(OUTPUT_DIR, filename))
    logger.info(
        "generate done: %.2fs audio (sr=%d, %d samples) synthesized in %.1fs -> %s",
        duration, sr, len(audio), elapsed, path,
    )
    status = f"{filename}  ({duration:.1f}s, {sr} Hz, model={model_name})"
    # audio player + download both get the saved file; status echoes the name
    return path, path, status


def build_ui() -> gr.Blocks:
    labels = [p.label for p in presets.presets()]
    with gr.Blocks(title="Local TTS") as demo:
        gr.Markdown("# Local Text-to-Speech\nType text, pick a voice, generate.")
        text = gr.Textbox(label="Text", lines=4, placeholder="नमस्ते / Hello…")
        preset = gr.Dropdown(labels, value=labels[0], label="Voice preset")
        advanced = gr.Textbox(
            label="Advanced override (optional)",
            placeholder="Parler: voice description · Kokoro: voice id (e.g. hf_alpha)",
        )
        btn = gr.Button("Generate", variant="primary")
        status_out = gr.Textbox(label="Generated file", interactive=False)
        audio_out = gr.Audio(label="Play", type="filepath")
        file_out = gr.File(label="Download WAV")
        btn.click(
            generate,
            inputs=[text, preset, advanced],
            outputs=[audio_out, file_out, status_out],
        )
    return demo


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    build_ui().launch()


if __name__ == "__main__":
    main()
