# Mobile / On-Device TTS — Future Direction

**Status:** Idea / not yet designed. No code yet.
**Date:** 2026-06-28

## Goal

Run the TTS app on a normal phone, using the phone's GPU for inference (on-device,
offline-capable), not just as a client to a server.

## Decision

**Chosen path: Web app + WebGPU** (e.g. kokoro.js / Transformers.js with ONNX Runtime
Web's WebGPU backend). Cross-platform (iOS + Android in one codebase), uses the phone
GPU, no app store. Graduate to native ONNX Runtime Mobile only if a true
installable/offline app or higher performance is needed later.

## Model reality

- **Indic Parler-TTS** — NOT viable on-device (~1B params, autoregressive, ~2 GB).
- **Kokoro-82M** — the on-device candidate. Small (82M), faster-than-realtime even on
  CPU, has an ONNX export and Hindi + English voices (matches the Indian-voice goal).
- Implication: the mobile build is effectively **Kokoro-only**, a quality step-down from
  Parler. The existing `TTSBackend` abstraction makes a "Kokoro-only" build clean.

## On-device runtime options (for reference)

| Path | GPU access | Effort | When |
|---|---|---|---|
| Web + WebGPU (kokoro.js / Transformers.js / ORT-Web) | Browser WebGPU → phone GPU | Lowest | **Chosen.** Cross-platform, no app store. |
| ONNX Runtime Mobile (native or Flutter/RN wrapper) | Core ML EP (iOS) / NNAPI EP (Android) → GPU + NPU | Medium | Installable, offline, better perf. |
| ExecuTorch / Core ML / TFLite | Native NPU/GPU delegates | High | Max control/perf, single platform. |

## WebGPU — what it does and does NOT reach (clarification)

WebGPU **is** real GPU compute from the browser (compute shaders) — enough to run
Kokoro-82M on the phone GPU. But it is not the full native accelerator stack:

- **No NPU / Neural Engine access.** Phones have dedicated ML accelerators (Apple Neural
  Engine, Qualcomm Hexagon NPU). WebGPU targets the **GPU only**. Native runtimes
  (Core ML, NNAPI) can dispatch to the NPU, which is often faster and more
  power-efficient for ML than the GPU. That is what "native GPU/NPU" meant — the full
  accelerator stack, not just the GPU.
- **Sandboxed + portable subset.** WebGPU is a portable browser API with overhead and a
  feature subset vs native Metal/Vulkan; no custom kernels; per-tab memory limits.
- **Maturity / fallback.** WebGPU on mobile is relatively new (iOS Safari 17/18+, recent
  Android Chrome) and can fall back to slower WASM/CPU when unavailable or when an op
  isn't supported in the WebGPU backend.

Net: WebGPU is plenty for Kokoro-82M; it's just not the absolute fastest/most
power-efficient ceiling that native NPU paths reach.

## Wrinkle to test early

Kokoro needs a **phonemizer** (grapheme→phoneme; the `espeak-ng`/misaki step used on the
Mac). On-device cannot shell out to `espeak-ng` — the browser/native builds bundle their
own phonemizer. **Hindi G2P quality in the bundled phonemizer is the first thing to
validate**, since Hindi is the priority.

## Open decisions before designing

- iOS / Android / both (WebGPU path covers both, but test each).
- Browser/PWA vs eventual installable app.
- Offline-required vs network-OK.
