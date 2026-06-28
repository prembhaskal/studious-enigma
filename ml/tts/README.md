# Local Text-to-Speech

A local (macOS / Apple Silicon) text-to-speech app with a Gradio UI and swappable
models. Targets a young Indian female voice (Hindi / English).

## Models
- **Indic Parler-TTS** (`ai4bharat/indic-parler-tts`) — voice via free-text description.
- **Kokoro-82M** — voice via fixed voice id (e.g. `hf_alpha`).

Pick a voice via the **preset** dropdown; the model is chosen by the preset. Built-in presets:

| Preset | Model | Voice |
|---|---|---|
| Young Indian Female – Hindi (Parler) | Parler | Indian-accent description |
| Young Indian Female – English (Parler) | Parler | Indian-accent description |
| Young Indian Female – Hindi (Kokoro) | Kokoro | `hf_alpha` (Hindi G2P) |
| Young Indian Female – English (Kokoro, US accent) | Kokoro | `af_heart` (US-English) |

Kokoro has no Indian-accented *English* voice — for Indian-accented English use the Parler
English preset. The **Advanced override** box lets you supply a custom Parler description or
Kokoro voice id (e.g. `bf_emma` for British English).

## Setup
```bash
cd ml/tts
python3.12 -m venv .venv
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
Open the printed local URL, type text, pick a preset, click **Generate**. You can **play**
the result in the browser and **download** the WAV; the generated filename is shown in the
**Generated file** box. Each run is saved to a unique `outputs/tts-<model>-<timestamp>-<id>.wav`
(runs don't overwrite each other). First use of each model downloads its weights (slow once).

The terminal prints concise INFO logs (model load/download progress and per-request timing),
e.g. `20:07:37  parler: model loaded in 15.6s`.

**Note:** Indic Parler-TTS is a gated HuggingFace model. Before using it, you must:
1. Accept the terms at https://huggingface.co/ai4bharat/indic-parler-tts (while logged in to HuggingFace).
2. Authenticate locally via `huggingface-cli login` or by setting an HF token.

Kokoro requires no such setup.

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
