# Local Text-to-Speech App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A locally-runnable (macOS/Apple Silicon) text-to-speech app with a Gradio web UI that supports swappable TTS models, targeting a young Indian female voice (Hindi/English).

**Architecture:** A registry of pluggable TTS backends behind one common interface (`TTSBackend` + `VoiceConfig`), with a thin Gradio UI on top. Backends are lazy-loaded and cached. Synthesis returns raw audio `(sample_rate, ndarray)`; a separate `output.py` stage writes WAV (future seam for audio→video). Two backends at launch: Indic Parler-TTS (prompt-controlled voice) and Kokoro-82M (voice-ID controlled).

**Tech Stack:** Python 3.12 (Kokoro pins `numpy==1.26.4`, which has no 3.13 wheel), venv + pip, Gradio, PyTorch (MPS), `parler-tts` + `transformers`, `kokoro` + `espeak-ng`, `soundfile`/`numpy`, `pytest`. Parler's deps require system `git-lfs`.

## Global Constraints

- Target OS: macOS Apple Silicon. Prefer device `mps`, fall back to `cpu`. Never assume CUDA.
- Project lives in `ml/tts/`. Its own venv at `ml/tts/.venv` — isolated from `ml/fastai/.venv`. Build the venv with **Python 3.12** (`python3.12`): Kokoro pins `numpy==1.26.4` which has no Python 3.13 wheel. System `git-lfs` must be installed (`brew install git-lfs && git lfs install`) for Parler's deps.
- Personal repo (`prembhaskal/studious-enigma`): no JIRA id in branches or commits.
- All work on branch `tts-text-to-speech-app` (already created).
- Default `pytest` run must NOT download models or require a GPU. Tests touching real models are marked `@pytest.mark.models` and excluded by default.
- Common backend contract: `synthesize(text, voice) -> (sample_rate: int, audio: np.ndarray)`; `audio` is 1-D float32.
- Backends ignore `VoiceConfig` fields they don't support (must not raise on unknown/extra fields).

---

### Task 1: Project scaffold, venv, and device helper

**Files:**
- Create: `ml/tts/requirements.txt`
- Create: `ml/tts/.gitignore`
- Create: `ml/tts/tts/__init__.py`
- Create: `ml/tts/tts/device.py`
- Create: `ml/tts/tests/__init__.py`
- Create: `ml/tts/tests/test_device.py`
- Create: `ml/tts/pyproject.toml` (pytest config + marker registration)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `tts.device.pick_device() -> str` returning `"mps"` or `"cpu"`.

- [ ] **Step 1: Create the venv and project directories**

```bash
cd ml/tts 2>/dev/null || mkdir -p ml/tts && cd ml/tts
python3.12 -m venv .venv      # 3.12 — Kokoro's numpy==1.26.4 has no 3.13 wheel
source .venv/bin/activate
pip install --upgrade pip
mkdir -p tts tests
# system dep for Parler:
brew install git-lfs && git lfs install
```

- [ ] **Step 2: Write `ml/tts/requirements.txt`**

```text
# UI
gradio

# Core ML / audio
torch
transformers
soundfile
numpy

# Indic Parler-TTS (installed from git — not on PyPI)
parler-tts @ git+https://github.com/huggingface/parler-tts.git

# Kokoro-82M (requires system espeak-ng for Hindi: `brew install espeak-ng`)
kokoro

# Tests
pytest
```

- [ ] **Step 3: Write `ml/tts/.gitignore`**

```text
.venv/
__pycache__/
*.pyc
*.wav
.gradio/
outputs/
```

- [ ] **Step 4: Write `ml/tts/pyproject.toml` (pytest config)**

```toml
[tool.pytest.ini_options]
markers = [
    "models: tests that download/run real TTS models (deselected by default)",
]
addopts = "-m 'not models'"
testpaths = ["tests"]
```

- [ ] **Step 5: Write the failing test** — `ml/tts/tests/test_device.py`

```python
from tts.device import pick_device


def test_pick_device_returns_supported_value():
    assert pick_device() in {"mps", "cpu"}


def test_pick_device_falls_back_to_cpu_when_mps_unavailable(monkeypatch):
    import torch

    monkeypatch.setattr(torch.backends.mps, "is_available", lambda: False)
    assert pick_device() == "cpu"
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd ml/tts && source .venv/bin/activate && pip install -r requirements.txt && python -m pytest tests/test_device.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'tts.device'` (after deps install).

- [ ] **Step 7: Write `ml/tts/tts/__init__.py`**

```python
```

(empty file — marks the package)

- [ ] **Step 8: Write `ml/tts/tests/__init__.py`**

```python
```

(empty file)

- [ ] **Step 9: Write the implementation** — `ml/tts/tts/device.py`

```python
"""Pick the best available torch device on this machine."""
import torch


def pick_device() -> str:
    """Return "mps" on Apple Silicon when available, else "cpu"."""
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"
```

- [ ] **Step 10: Run test to verify it passes**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest tests/test_device.py -v`
Expected: PASS (2 passed)

- [ ] **Step 11: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add ml/tts/requirements.txt ml/tts/.gitignore ml/tts/pyproject.toml ml/tts/tts/__init__.py ml/tts/tts/device.py ml/tts/tests/__init__.py ml/tts/tests/test_device.py
git commit -m "feat: scaffold tts app with venv, deps, and device helper"
```

---

### Task 2: Core interface — `VoiceConfig` and `TTSBackend`

**Files:**
- Create: `ml/tts/tts/base.py`
- Create: `ml/tts/tests/fakes.py`
- Create: `ml/tts/tests/test_base.py`

**Interfaces:**
- Consumes: nothing from base.
- Produces:
  - `tts.base.VoiceConfig` dataclass: fields `description: str | None = None`, `voice_id: str | None = None`, `speed: float | None = None`, `pitch: float | None = None`.
  - `tts.base.TTSBackend` ABC: class attr `name: str`; abstract `load(self) -> None`; abstract `synthesize(self, text: str, voice: VoiceConfig) -> tuple[int, np.ndarray]`.
  - `tests.fakes.FakeBackend(TTSBackend)`: `name = "fake"`; counts `load()` calls; `synthesize` returns `(16000, np.zeros(1600, dtype=np.float32))` and records the last `voice` it received.

- [ ] **Step 1: Write the failing test** — `ml/tts/tests/test_base.py`

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest tests/test_base.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'tts.base'`

- [ ] **Step 3: Write `ml/tts/tts/base.py`**

```python
"""Common interface for all TTS backends."""
from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np


@dataclass
class VoiceConfig:
    """How a backend should voice the text.

    Backends use the fields they support and ignore the rest, so new fields
    (e.g. speed, pitch) can be added without breaking existing backends.
    """

    description: str | None = None  # Parler: free-text voice description
    voice_id: str | None = None     # Kokoro: fixed voice id
    speed: float | None = None      # future / per-backend optional
    pitch: float | None = None      # future / per-backend optional


class TTSBackend(ABC):
    """A swappable text-to-speech model."""

    name: str = ""

    @abstractmethod
    def load(self) -> None:
        """Load weights into memory. Idempotent; may download on first call."""

    @abstractmethod
    def synthesize(self, text: str, voice: VoiceConfig) -> tuple[int, np.ndarray]:
        """Return (sample_rate, mono float32 audio)."""
```

- [ ] **Step 4: Write `ml/tts/tests/fakes.py`**

```python
"""Test doubles used by offline unit tests."""
import numpy as np

from tts.base import TTSBackend, VoiceConfig


class FakeBackend(TTSBackend):
    name = "fake"

    def __init__(self):
        self.load_calls = 0
        self.last_voice: VoiceConfig | None = None

    def load(self) -> None:
        self.load_calls += 1

    def synthesize(self, text: str, voice: VoiceConfig) -> tuple[int, np.ndarray]:
        self.last_voice = voice
        return 16000, np.zeros(1600, dtype=np.float32)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest tests/test_base.py -v`
Expected: PASS (3 passed)

- [ ] **Step 6: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add ml/tts/tts/base.py ml/tts/tests/fakes.py ml/tts/tests/test_base.py
git commit -m "feat: add TTSBackend interface and VoiceConfig"
```

---

### Task 3: Backend registry with lazy load + caching

**Files:**
- Create: `ml/tts/tts/registry.py`
- Create: `ml/tts/tests/conftest.py`
- Create: `ml/tts/tests/test_registry.py`

**Interfaces:**
- Consumes: `tts.base.TTSBackend`.
- Produces:
  - `tts.registry.register(name: str, cls: type[TTSBackend]) -> None`
  - `tts.registry.available_models() -> list[str]` (sorted names)
  - `tts.registry.get(name: str) -> TTSBackend` (instantiates + `load()`s on first call, caches instance; raises `KeyError` for unknown name)
  - `tts.registry.clear() -> None` (test helper: empties registry + cache)

- [ ] **Step 1: Write `ml/tts/tests/conftest.py`** (fixture clears global registry between tests)

```python
import pytest

from tts import registry


@pytest.fixture(autouse=True)
def _clean_registry():
    registry.clear()
    yield
    registry.clear()
```

- [ ] **Step 2: Write the failing test** — `ml/tts/tests/test_registry.py`

```python
import pytest

from tts import registry
from tests.fakes import FakeBackend


def test_register_and_available_models():
    registry.register("fake", FakeBackend)
    assert registry.available_models() == ["fake"]


def test_available_models_is_sorted():
    registry.register("zeta", FakeBackend)
    registry.register("alpha", FakeBackend)
    assert registry.available_models() == ["alpha", "zeta"]


def test_get_lazy_loads_and_caches():
    registry.register("fake", FakeBackend)
    first = registry.get("fake")
    second = registry.get("fake")
    assert first is second          # cached, same instance
    assert first.load_calls == 1    # loaded exactly once


def test_get_unknown_raises_keyerror():
    with pytest.raises(KeyError):
        registry.get("does-not-exist")
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest tests/test_registry.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'tts.registry'`

- [ ] **Step 4: Write `ml/tts/tts/registry.py`**

```python
"""Name -> backend registry with lazy instantiation and caching."""
from tts.base import TTSBackend

_CLASSES: dict[str, type[TTSBackend]] = {}
_INSTANCES: dict[str, TTSBackend] = {}


def register(name: str, cls: type[TTSBackend]) -> None:
    _CLASSES[name] = cls


def available_models() -> list[str]:
    return sorted(_CLASSES)


def get(name: str) -> TTSBackend:
    """Return a loaded backend, instantiating and loading it on first use."""
    if name not in _CLASSES:
        raise KeyError(name)
    if name not in _INSTANCES:
        backend = _CLASSES[name]()
        backend.load()
        _INSTANCES[name] = backend
    return _INSTANCES[name]


def clear() -> None:
    """Test helper: drop all registrations and cached instances."""
    _CLASSES.clear()
    _INSTANCES.clear()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest tests/test_registry.py -v`
Expected: PASS (4 passed)

- [ ] **Step 6: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add ml/tts/tts/registry.py ml/tts/tests/conftest.py ml/tts/tests/test_registry.py
git commit -m "feat: add lazy-loading, caching backend registry"
```

---

### Task 4: Voice presets

**Files:**
- Create: `ml/tts/tts/presets.py`
- Create: `ml/tts/tests/test_presets.py`

**Interfaces:**
- Consumes: `tts.base.VoiceConfig`.
- Produces:
  - `tts.presets.Preset` dataclass: `label: str`, `model: str`, `voice: VoiceConfig`.
  - `tts.presets.presets() -> list[Preset]` (all presets).
  - `tts.presets.presets_for(model: str) -> list[Preset]` (presets whose `.model == model`).
  - `tts.presets.by_label(label: str) -> Preset` (raises `KeyError` if missing).
  - Model names used: `"parler"`, `"kokoro"` (must match registry names in Tasks 5–6).

- [ ] **Step 1: Write the failing test** — `ml/tts/tests/test_presets.py`

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest tests/test_presets.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'tts.presets'`

- [ ] **Step 3: Write `ml/tts/tts/presets.py`**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest tests/test_presets.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add ml/tts/tts/presets.py ml/tts/tests/test_presets.py
git commit -m "feat: add curated voice presets"
```

---

### Task 5: WAV output stage

**Files:**
- Create: `ml/tts/tts/output.py`
- Create: `ml/tts/tests/test_output.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `tts.output.save_wav(sample_rate: int, audio: np.ndarray, path: str) -> str` — writes a WAV file and returns `path`. (This is the seam where a future audio→video step would attach.)

- [ ] **Step 1: Write the failing test** — `ml/tts/tests/test_output.py`

```python
import numpy as np
import soundfile as sf

from tts.output import save_wav


def test_save_wav_writes_readable_file(tmp_path):
    audio = np.linspace(-0.5, 0.5, 2400, dtype=np.float32)
    out = tmp_path / "clip.wav"

    returned = save_wav(24000, audio, str(out))

    assert returned == str(out)
    assert out.exists()
    data, sr = sf.read(str(out))
    assert sr == 24000
    assert len(data) == 2400
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest tests/test_output.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'tts.output'`

- [ ] **Step 3: Write `ml/tts/tts/output.py`**

```python
"""Write synthesized audio to disk. Future: audio -> video lives here too."""
import numpy as np
import soundfile as sf


def save_wav(sample_rate: int, audio: np.ndarray, path: str) -> str:
    """Write mono float32 audio to a WAV file at `path` and return `path`."""
    sf.write(path, np.asarray(audio, dtype=np.float32), sample_rate)
    return path
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest tests/test_output.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add ml/tts/tts/output.py ml/tts/tests/test_output.py
git commit -m "feat: add WAV output stage"
```

---

### Task 6: Kokoro-82M backend

**Files:**
- Create: `ml/tts/tts/kokoro_backend.py`
- Create: `ml/tts/tests/test_kokoro_backend.py`

**Interfaces:**
- Consumes: `tts.base.TTSBackend`, `tts.base.VoiceConfig`, `tts.registry.register`.
- Produces: `tts.kokoro_backend.KokoroBackend` with `name = "kokoro"`; self-registers via `register("kokoro", KokoroBackend)` at import. Output sample rate: `24000`. Derives Kokoro `lang_code` from the first char of `voice.voice_id` (`"h"` → Hindi, default `"a"` → American English).

**Notes for the implementer:**
- Kokoro needs system `espeak-ng` for Hindi: `brew install espeak-ng`.
- `KPipeline(lang_code=...)` returns a generator yielding `(graphemes, phonemes, audio)` per chunk. Concatenate the audio chunks. Each `audio` chunk is a torch tensor; convert with `.detach().cpu().numpy()`.

- [ ] **Step 1: Write the failing test** — `ml/tts/tests/test_kokoro_backend.py`

```python
import numpy as np
import pytest

from tts import registry
import tts.kokoro_backend  # noqa: F401  (registers "kokoro")
from tts.base import VoiceConfig


def test_kokoro_registers_itself():
    assert "kokoro" in registry.available_models()


def test_lang_code_for_voice():
    from tts.kokoro_backend import KokoroBackend

    assert KokoroBackend._lang_code("hf_alpha") == "h"
    assert KokoroBackend._lang_code("af_heart") == "a"
    assert KokoroBackend._lang_code(None) == "a"


@pytest.mark.models
def test_kokoro_synthesizes_audio():
    backend = registry.get("kokoro")
    sr, audio = backend.synthesize("नमस्ते, आप कैसे हैं?", VoiceConfig(voice_id="hf_alpha"))
    assert sr == 24000
    assert isinstance(audio, np.ndarray)
    assert audio.ndim == 1
    assert audio.size > 0
```

Note: `test_kokoro_registers_itself` relies on the autouse `_clean_registry` fixture clearing the registry, then re-importing won't re-run module-level `register`. To keep the test robust, the conftest fixture must NOT clear registrations made at import time for this test — instead this test calls `registry.register` explicitly. Replace the first test body with:

```python
def test_kokoro_registers_itself():
    from tts.kokoro_backend import KokoroBackend

    registry.register("kokoro", KokoroBackend)
    assert "kokoro" in registry.available_models()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest tests/test_kokoro_backend.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'tts.kokoro_backend'`

- [ ] **Step 3: Write `ml/tts/tts/kokoro_backend.py`**

```python
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
```

- [ ] **Step 4: Run the offline tests to verify they pass**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest tests/test_kokoro_backend.py -v`
Expected: PASS for the 2 offline tests; `test_kokoro_synthesizes_audio` is deselected (marker `models`).

- [ ] **Step 5: (Manual, optional) verify real synthesis**

Run: `cd ml/tts && source .venv/bin/activate && brew list espeak-ng >/dev/null 2>&1 || brew install espeak-ng; python -m pytest tests/test_kokoro_backend.py -v -m models`
Expected: PASS (downloads Kokoro weights on first run).

- [ ] **Step 6: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add ml/tts/tts/kokoro_backend.py ml/tts/tests/test_kokoro_backend.py
git commit -m "feat: add Kokoro-82M backend"
```

---

### Task 7: Indic Parler-TTS backend

**Files:**
- Create: `ml/tts/tts/parler_backend.py`
- Create: `ml/tts/tests/test_parler_backend.py`

**Interfaces:**
- Consumes: `tts.base.TTSBackend`, `tts.base.VoiceConfig`, `tts.registry.register`, `tts.device.pick_device`.
- Produces: `tts.parler_backend.ParlerBackend` with `name = "parler"`; self-registers via `register("parler", ParlerBackend)` at import. Model id `"ai4bharat/indic-parler-tts"`. Output sample rate from `model.config.sampling_rate`. Voice comes from `voice.description`.

**Notes for the implementer:**
- Two tokenizers: the prompt tokenizer (`AutoTokenizer.from_pretrained(MODEL_ID)`) and the description tokenizer (`AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)`).
- `model.generate(input_ids=description_ids, attention_mask=..., prompt_input_ids=prompt_ids, prompt_attention_mask=...)`.

- [ ] **Step 1: Write the failing test** — `ml/tts/tests/test_parler_backend.py`

```python
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
    backend = registry.get("parler")
    voice = VoiceConfig(description="A young Indian woman speaks clearly. Very clear recording.")
    sr, audio = backend.synthesize("नमस्ते, मेरा नाम अंजली है।", voice)
    assert isinstance(sr, int) and sr > 0
    assert isinstance(audio, np.ndarray) and audio.ndim == 1 and audio.size > 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest tests/test_parler_backend.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'tts.parler_backend'`

- [ ] **Step 3: Write `ml/tts/tts/parler_backend.py`**

```python
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
```

- [ ] **Step 4: Run the offline tests to verify they pass**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest tests/test_parler_backend.py -v`
Expected: PASS for the 2 offline tests; `test_parler_synthesizes_audio` deselected.

- [ ] **Step 5: (Manual, optional) verify real synthesis**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest tests/test_parler_backend.py -v -m models`
Expected: PASS (downloads Parler weights on first run; slow).

- [ ] **Step 6: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add ml/tts/tts/parler_backend.py ml/tts/tests/test_parler_backend.py
git commit -m "feat: add Indic Parler-TTS backend"
```

---

### Task 8: Gradio app + synthesis wiring

**Files:**
- Create: `ml/tts/app.py`
- Create: `ml/tts/tests/test_app.py`

**Interfaces:**
- Consumes: `tts.registry`, `tts.presets`, `tts.output`, `tts.base.VoiceConfig`, and both backend modules (imported for their self-registration).
- Produces:
  - `app.resolve_voice(preset_label: str, advanced_override: str | None) -> tuple[str, VoiceConfig]` → returns `(model_name, voice)`. If `advanced_override` is non-empty, it replaces the preset's `description` (Parler) or `voice_id` (Kokoro) depending on the preset's model.
  - `app.generate(text: str, preset_label: str, advanced_override: str | None) -> tuple[tuple[int, np.ndarray], str]` → returns `((sample_rate, audio), wav_path)`. Raises `gradio.Error` on empty text.
  - `app.build_ui()` → returns a `gradio.Blocks` (not launched in tests).
  - `app.main()` → launches the UI.

- [ ] **Step 1: Write the failing test** — `ml/tts/tests/test_app.py`

```python
import numpy as np
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


def test_generate_returns_audio_and_path(tmp_path, fake_kokoro_preset, monkeypatch):
    monkeypatch.setattr(app, "OUTPUT_DIR", str(tmp_path))
    (sr, audio), path = app.generate("hello", fake_kokoro_preset.label, None)
    assert sr == 16000
    assert isinstance(audio, np.ndarray)
    assert path.endswith(".wav")


def test_generate_empty_text_raises():
    import gradio as gr

    with pytest.raises(gr.Error):
        app.generate("   ", presets.presets()[0].label, None)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest tests/test_app.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app'` (or `gradio.Error` import path).

- [ ] **Step 3: Write `ml/tts/app.py`**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest tests/test_app.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Run the full offline suite**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest -v`
Expected: PASS, with the `models`-marked tests deselected.

- [ ] **Step 6: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add ml/tts/app.py ml/tts/tests/test_app.py
git commit -m "feat: add Gradio UI and synthesis wiring"
```

---

### Task 9: README and manual end-to-end check

**Files:**
- Create: `ml/tts/README.md`

**Interfaces:**
- Consumes: everything above. Produces: documentation only.

- [ ] **Step 1: Write `ml/tts/README.md`**

````markdown
# Local Text-to-Speech

A local (macOS / Apple Silicon) text-to-speech app with a Gradio UI and swappable
models. Targets a young Indian female voice (Hindi / English).

## Models
- **Indic Parler-TTS** (`ai4bharat/indic-parler-tts`) — voice via free-text description.
- **Kokoro-82M** — voice via fixed voice id (e.g. `hf_alpha`).

## Setup
```bash
cd ml/tts
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
brew install espeak-ng   # required by Kokoro for Hindi
```

## Run
```bash
source .venv/bin/activate
python app.py
```
Open the printed local URL, type text, pick a preset, click **Generate**.
First use of each model downloads its weights (slow once).

## Tests
```bash
python -m pytest            # fast, offline (no model downloads)
python -m pytest -m models  # runs real models (downloads weights)
```

## Extending
- **New model:** add `tts/<name>_backend.py` implementing `TTSBackend`, call
  `register("<name>", YourBackend)`, import it in `app.py`, add presets in `tts/presets.py`.
- **New voice controls** (speed, pitch): add fields to `VoiceConfig`; backends use what
  they support.
- **Audio → video:** extend `tts/output.py` (the post-synthesis stage).
````

- [ ] **Step 2: Run the full offline suite one more time**

Run: `cd ml/tts && source .venv/bin/activate && python -m pytest -v`
Expected: PASS (all offline tests).

- [ ] **Step 3: (Manual) launch the app and generate one clip per model**

Run: `cd ml/tts && source .venv/bin/activate && python app.py`
Expected: UI opens; generating with a Parler preset and a Kokoro preset each produces audible audio and a downloadable WAV.

- [ ] **Step 4: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add ml/tts/README.md
git commit -m "docs: add tts app README"
```

---

## Self-Review Notes

- **Spec coverage:** local macOS/MPS (Task 1 `device.py`); Gradio UI (Task 8); model switching via registry + dropdown (Tasks 3, 8); Indic Parler-TTS (Task 7); Kokoro-82M (Task 6); curated presets + advanced override (Tasks 4, 8); separate venv (Task 1); future seams — `VoiceConfig` open fields (Task 2), `output.py` stage (Task 5). All covered.
- **Type consistency:** `synthesize(text, VoiceConfig) -> (int, np.ndarray)` used identically across `FakeBackend`, `KokoroBackend`, `ParlerBackend`. Registry names `"parler"`/`"kokoro"` match between presets (Task 4) and backend registration (Tasks 6–7).
- **Marker:** `models` registered in `pyproject.toml` and excluded by default `addopts`, so the default suite never downloads weights.
