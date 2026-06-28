"""Kokoro-82M backend. Voice chosen by fixed voice id (e.g. 'hf_alpha')."""
import numpy as np

from tts.base import TTSBackend, VoiceConfig
from tts.registry import register

SAMPLE_RATE = 24000


class KokoroBackend(TTSBackend):
    name = "kokoro"

    def __init__(self):
        self._pipelines: dict[str, object] = {}  # lang_code -> KPipeline

    @staticmethod
    def _lang_code(voice_id: str | None) -> str:
        """Map a voice id's prefix to a Kokoro lang code. Default English."""
        if voice_id and voice_id[0] == "h":
            return "h"  # Hindi
        return "a"      # American English

    def load(self) -> None:
        # Pipelines are created lazily per language on first synthesize().
        pass

    def _pipeline(self, lang_code: str):
        from kokoro import KPipeline

        if lang_code not in self._pipelines:
            self._pipelines[lang_code] = KPipeline(lang_code=lang_code)
        return self._pipelines[lang_code]

    def synthesize(self, text: str, voice: VoiceConfig) -> tuple[int, np.ndarray]:
        voice_id = voice.voice_id or "af_heart"
        speed = voice.speed if voice.speed is not None else 1.0
        pipeline = self._pipeline(self._lang_code(voice_id))

        chunks: list[np.ndarray] = []
        for _gs, _ps, audio in pipeline(text, voice=voice_id, speed=speed):
            arr = audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio)
            chunks.append(arr.astype(np.float32))

        if not chunks:
            return SAMPLE_RATE, np.zeros(0, dtype=np.float32)
        return SAMPLE_RATE, np.concatenate(chunks)


register("kokoro", KokoroBackend)
