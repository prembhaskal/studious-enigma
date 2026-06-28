# Kaggle Hosting — Future Direction

**Status:** Idea / not yet designed. No code yet.
**Date:** 2026-06-28

## Goal

Let others try the app on a **free cloud GPU**, so they can run the **bigger models**
(e.g. Indic Parler-TTS, and larger TTS models that can't run on a laptop/phone).
Complements — does not replace — the local Mac app and the on-device mobile/WebGPU path.

Why Kaggle: free GPU notebooks (the fast.ai course used Kaggle), so no one needs their
own GPU to try the heavier models.

## How it works (high level)

The current app is plain Python + Gradio, so it runs on Kaggle with minimal change:
- A Kaggle Notebook installs `requirements.txt`, imports the app, and calls
  `build_ui().launch(share=True)`.
- `share=True` gives a temporary public `*.gradio.live` URL others can open in a browser
  — the heavy model runs on Kaggle's GPU, the user just types text and plays audio.

## Kaggle specifics to know

- **Free GPUs:** ~2× T4 or 1× P100, with a weekly quota (~30 GPU-hours/week). Plenty for
  Parler and bigger models.
- **Not always-on:** Kaggle sessions are time-limited (notebooks idle out after a few
  hours; max run ~12h). The `gradio.live` tunnel link lasts ~72h but the backend dies
  when the kernel stops. So Kaggle is great for **"try it / demo on a big GPU,"** not a
  stable 24/7 host.
- **Gated models:** Indic Parler-TTS is gated on HuggingFace. On Kaggle, store an HF token
  as a **Kaggle Secret** and authenticate in the notebook so the gated weights download.
- **MPS vs CUDA:** `device.py` picks `mps` on Mac; on Kaggle it must pick `cuda`. Extend
  `pick_device()` to prefer `cuda` when available (currently it's mps-or-cpu only). Small,
  clean change when this is built.

## Persistent alternative (note for later)

If a stable always-on host is wanted instead of a demo tunnel, **HuggingFace Spaces**
(free CPU tier, or paid GPU) is the more natural fit and pairs well with the gated-model
auth already on HF. Kaggle stays the "free big-GPU sandbox to try heavy models" option.

## Open decisions before designing

- Just a shareable notebook, or a polished Space too?
- Which "bigger models" to expose beyond Parler (e.g. XTTS-v2, larger multilingual TTS)?
- How to manage the HF token / gated access for visitors.
