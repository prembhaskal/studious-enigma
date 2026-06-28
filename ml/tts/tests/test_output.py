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
