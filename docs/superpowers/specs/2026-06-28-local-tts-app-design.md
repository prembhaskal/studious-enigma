# Local Text-to-Speech App — Design

**Date:** 2026-06-28
**Status:** Approved (pending implementation plan)

## Goal

A locally-runnable (macOS, Apple Silicon) text-to-speech application with a simple
Gradio web UI, supporting multiple swappable TTS models. Primary target voice:
young (20s) Indian female, speaking Hindi and English.

## Background

The user referenced [huggingface/speech-to-speech](https://github.com/huggingface/speech-to-speech).
That project is a full **conversational** pipeline (mic → STT → LLM → TTS), not a
text-to-speech tool. The genuinely reusable idea is its **pluggable TTS handler
pattern** — wrapping several TTS models behind one common interface. This design
adopts that pattern; it does not reuse the repo's pipeline code.

The user is new to ML (early in the fast.ai course) and wants a flexible foundation
to build on later. Two future directions were called out explicitly and the design
leaves clean seams for them, but does **not** implement them now (YAGNI):
- generating a video from the audio output (e.g. via ffmpeg)
- finer voice control (speed, pitch/deepness, etc.)

## Requirements

- Runs locally on macOS (Apple Silicon / M3 Max), using Metal (MPS) when available,
  falling back to CPU.
- Text in → audio out, via a simple Gradio web UI.
- Supports multiple TTS models that can be switched at runtime. At launch:
  1. **Indic Parler-TTS** (`ai4bharat/indic-parler-tts`) — voice described via a free-text
     prompt; built for Indian languages (Hindi + English + others).
  2. **Kokoro-82M** — lightweight, fast on MPS; voice chosen from fixed voice IDs.
- Voice selection via **curated presets** (tuned for the target voice) with an
  **advanced override** (free-text prompt for Parler / voice ID for Kokoro).

## Non-Goals (for this version)

- Conversational / speech-to-speech / real-time microphone input.
- Audio → video generation (future; seam left open).
- Fine-grained voice controls beyond what presets carry (future; seam left open).
- Voice cloning (XTTS-v2 and MeloTTS were considered and deferred).
- Commercial use / deployment / packaging beyond local run.

## Architecture

A registry of pluggable TTS backends behind one common interface, with a thin Gradio
UI on top. Adding a new model later means adding one backend file plus a registry
entry — no UI or interface changes.

> **Implementation note (post-build):** The shipped UI has a single **preset dropdown**;
> the model is derived from the chosen preset (each preset pins its backend) rather than
> a separate model dropdown. This is simpler UX and is what the implementation plan and
> `app.py` reflect.

```
ml/tts/
  app.py              # Gradio UI: text box, model dropdown, preset dropdown, advanced override, play/download
  tts/
    __init__.py
    base.py           # TTSBackend ABC + VoiceConfig dataclass
    registry.py       # name -> backend class; lazy-instantiates & caches loaded backends
    parler_backend.py # Indic Parler-TTS (prompt-controlled voice)
    kokoro_backend.py # Kokoro-82M (voice-ID controlled)
    presets.py        # curated presets -> per-backend VoiceConfig
    output.py         # save (sample_rate, ndarray) -> WAV file  (future: audio -> video seam)
    device.py         # pick "mps" if available else "cpu"
  tests/
    test_registry.py
    test_presets.py
    test_output.py
    test_backends.py  # FakeBackend for fast offline tests; real models behind opt-in marker
  requirements.txt
  README.md
```

### Key design decisions

- **Common interface** (`TTSBackend`): every model implements `load()` and
  `synthesize(text, voice_config) -> (sample_rate, np.ndarray)`. The UI and registry
  never touch model internals.
- **Open voice config**: `synthesize` takes a `VoiceConfig` dataclass with optional
  fields. Today it carries the Parler prompt and/or Kokoro voice ID. Future fields
  (`speed`, `pitch`, …) are added without changing the interface; backends use the
  fields they support and ignore the rest gracefully.
- **Lazy loading + caching**: the registry instantiates/loads a backend only on first
  selection, then caches the loaded instance. Switching back to an already-loaded
  model is instant.
- **MPS-first**: `device.py` selects `mps` on Apple Silicon, else `cpu`.
- **Output as a separate stage**: synthesis returns raw audio; `output.py` writes WAV.
  This is the natural place a future audio→video (ffmpeg) step plugs in.
- **Separate venv** at `ml/tts/.venv`, isolated from the existing `ml/fastai/.venv`
  (their dependency trees conflict). Personal repo — no JIRA, no shared CI assumptions.

### Interfaces (signatures)

```python
# tts/base.py
@dataclass
class VoiceConfig:
    # Parler: free-text voice description prompt
    description: str | None = None
    # Kokoro: voice id (e.g. a Hindi female voice)
    voice_id: str | None = None
    # Future, optional — backends ignore unsupported fields:
    speed: float | None = None
    pitch: float | None = None

class TTSBackend(ABC):
    name: str
    def load(self) -> None: ...                  # idempotent; downloads/loads weights
    def synthesize(self, text: str, voice: VoiceConfig) -> tuple[int, "np.ndarray"]: ...
```

```python
# tts/registry.py
def available_models() -> list[str]: ...
def get(name: str) -> TTSBackend: ...   # lazy-loads + caches the backend instance
```

```python
# tts/presets.py
@dataclass
class Preset:
    label: str
    model: str                 # registry name
    voice: VoiceConfig
def presets() -> list[Preset]: ...
def presets_for(model: str) -> list[Preset]: ...
```

```python
# tts/output.py
def save_wav(sample_rate: int, audio: "np.ndarray", path: str) -> str: ...
```

### Presets (initial)

- "Young Indian Female – Hindi (Parler)" → Parler, description prompt for a clear,
  expressive young Indian woman, recorded cleanly.
- "Young Indian Female – English (Parler)" → Parler, English-leaning description prompt.
- "Young Indian Female (Kokoro)" → Kokoro, a Hindi/English-capable female voice ID.

Exact prompt wording and Kokoro voice ID are finalized during implementation against
the live model docs.

## Data Flow

```
User types text + picks model + picks preset (+ optional advanced override)
  → app.py builds VoiceConfig from the preset, applying any override
  → registry.get(model_name)            # lazy-loads & caches backend
  → backend.synthesize(text, voice)     # -> (sample_rate, ndarray)
  → Gradio Audio component (play) + output.save_wav(...) (download)
```

## Error Handling

- **Empty/whitespace text** → friendly UI message, no synthesis call.
- **Model load failure** (missing weights, OOM, first-run download offline) → caught,
  shown as a readable UI error; app stays up so the user can switch models.
- **Unsupported voice param** → ignored by backends that don't support it (logged, not
  fatal) so future `speed`/`pitch` fields degrade gracefully on older backends.
- **First-run model download** → models download from HuggingFace on first use; UI shows
  a "loading model…" state.

## Testing

- **Offline unit tests** (default `pytest` run, no downloads, no GPU): registry lazy-load
  + caching, preset → `VoiceConfig` mapping, and `output.save_wav`, all against a
  `FakeBackend`.
- **Real-model tests** behind an opt-in marker (`pytest -m models`), run manually to
  verify actual audio generation.
- TDD: each backend's contract (returns `(sample_rate, ndarray)`, respects `VoiceConfig`)
  is specified by a test first.

## Tech Stack

- Python 3.13, venv + pip (matching repo convention).
- Gradio (web UI).
- PyTorch with MPS (Apple Silicon).
- `transformers` + `parler-tts` (Indic Parler-TTS), `kokoro` (Kokoro-82M).
- `soundfile`/`numpy` for WAV output.
- `pytest` for tests.
