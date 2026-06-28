from tts.device import pick_device


def test_pick_device_returns_supported_value():
    assert pick_device() in {"mps", "cpu"}


def test_pick_device_falls_back_to_cpu_when_mps_unavailable(monkeypatch):
    import torch

    monkeypatch.setattr(torch.backends.mps, "is_available", lambda: False)
    assert pick_device() == "cpu"
