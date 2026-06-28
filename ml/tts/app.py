"""Gradio web UI for the local text-to-speech app."""
import dataclasses
import os

import gradio as gr

from tts import output, presets, registry
from tts.base import VoiceConfig

# Importing the backends registers them with the registry.
import tts.kokoro_backend  # noqa: F401
import tts.parler_backend  # noqa: F401

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
    try:
        backend = registry.get(model_name)
        sr, audio = backend.synthesize(text, voice)
    except Exception as exc:  # surface load/synthesis failures in the UI
        raise gr.Error(f"Synthesis failed for model '{model_name}': {exc}")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = output.save_wav(sr, audio, os.path.join(OUTPUT_DIR, "out.wav"))
    return (sr, audio), path


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
        audio_out = gr.Audio(label="Output", type="numpy")
        file_out = gr.File(label="Download WAV")
        btn.click(generate, inputs=[text, preset, advanced], outputs=[audio_out, file_out])
    return demo


def main() -> None:
    build_ui().launch()


if __name__ == "__main__":
    main()
