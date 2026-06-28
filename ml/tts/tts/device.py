"""Pick the best available torch device on this machine."""
import torch


def pick_device() -> str:
    """Return "mps" on Apple Silicon when available, else "cpu"."""
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"
