"""Curated voice presets tuned for a young Indian female voice."""
from dataclasses import dataclass

from tts.base import VoiceConfig


@dataclass(frozen=True)
class Preset:
    label: str
    model: str          # registry name: "parler" or "kokoro"
    voice: VoiceConfig


_PRESETS: list[Preset] = [
    Preset(
        label="Young Indian Female – Hindi (Parler)",
        model="parler",
        voice=VoiceConfig(
            description=(
                "Anjali, a young Indian woman in her twenties, speaks Hindi in a "
                "clear, expressive and natural tone. The recording is very clear "
                "with no background noise."
            )
        ),
    ),
    Preset(
        label="Young Indian Female – English (Parler)",
        model="parler",
        voice=VoiceConfig(
            description=(
                "Anjali, a young Indian woman in her twenties, speaks English with "
                "a natural Indian accent in a clear and expressive tone. The "
                "recording is very clear with no background noise."
            )
        ),
    ),
    Preset(
        label="Young Indian Female – Hindi (Kokoro)",
        model="kokoro",
        voice=VoiceConfig(voice_id="hf_alpha"),
    ),
]


def presets() -> list[Preset]:
    return list(_PRESETS)


def presets_for(model: str) -> list[Preset]:
    return [p for p in _PRESETS if p.model == model]


def by_label(label: str) -> Preset:
    for p in _PRESETS:
        if p.label == label:
            return p
    raise KeyError(label)
