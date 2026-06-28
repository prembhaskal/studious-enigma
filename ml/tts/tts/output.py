"""Write synthesized audio to disk. Future: audio -> video lives here too."""
import numpy as np
import soundfile as sf


def save_wav(sample_rate: int, audio: np.ndarray, path: str) -> str:
    """Write mono float32 audio to a WAV file at `path` and return `path`."""
    sf.write(path, np.asarray(audio, dtype=np.float32), sample_rate)
    return path
