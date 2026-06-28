"""Indic Parler-TTS backend. Voice controlled by a free-text description."""
import numpy as np

from tts.base import TTSBackend, VoiceConfig
from tts.device import pick_device
from tts.registry import register

MODEL_ID = "ai4bharat/indic-parler-tts"
DEFAULT_DESCRIPTION = (
    "A young Indian woman speaks in a clear and natural tone. "
    "The recording is very clear with no background noise."
)


class ParlerBackend(TTSBackend):
    name = "parler"

    def __init__(self):
        self.device = pick_device()
        self.model = None
        self.tokenizer = None
        self.description_tokenizer = None

    @staticmethod
    def _description(voice: VoiceConfig) -> str:
        return voice.description or DEFAULT_DESCRIPTION

    def load(self) -> None:
        if self.model is not None:
            return
        from parler_tts import ParlerTTSForConditionalGeneration
        from transformers import AutoTokenizer

        self.model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL_ID).to(self.device)
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        self.description_tokenizer = AutoTokenizer.from_pretrained(
            self.model.config.text_encoder._name_or_path
        )

    def synthesize(self, text: str, voice: VoiceConfig) -> tuple[int, np.ndarray]:
        if self.model is None:
            self.load()

        description = self._description(voice)
        desc = self.description_tokenizer(description, return_tensors="pt").to(self.device)
        prompt = self.tokenizer(text, return_tensors="pt").to(self.device)

        generation = self.model.generate(
            input_ids=desc.input_ids,
            attention_mask=desc.attention_mask,
            prompt_input_ids=prompt.input_ids,
            prompt_attention_mask=prompt.attention_mask,
        )
        audio = generation.cpu().numpy().squeeze().astype(np.float32)
        return int(self.model.config.sampling_rate), audio


register("parler", ParlerBackend)
