"""Kokoro narration: one engine, one voice, one speed; level-matched; durations measured from the files.

usage: python3 tts.py <model_dir> [narration.json] [durations.json]
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = Path(__file__).parent
MODEL_DIR = Path(sys.argv[1])
NARRATION = HERE / (sys.argv[2] if len(sys.argv) > 2 else "narration.json")
DURATIONS = HERE / (sys.argv[3] if len(sys.argv) > 3 else "durations.json")
VOICE = "am_michael"
SPEED = 1.0
TARGET_RMS_DBFS = -20.0

lines = json.loads(NARRATION.read_text())
out_dir = HERE / "audio"
out_dir.mkdir(exist_ok=True)
kokoro = Kokoro(str(MODEL_DIR / "kokoro-v1.0.onnx"), str(MODEL_DIR / "voices-v1.0.bin"))

durations = {}
for line in lines:
    samples, sr = kokoro.create(line["text"], voice=VOICE, speed=SPEED, lang="en-us")
    samples = np.asarray(samples, dtype=np.float32)
    rms = float(np.sqrt(np.mean(np.square(samples)))) or 1e-9
    gain = (10 ** (TARGET_RMS_DBFS / 20)) / rms
    samples = np.clip(samples * gain, -0.99, 0.99)
    path = out_dir / f"{line['id']}.wav"
    sf.write(path, samples, sr)
    info = sf.info(path)
    durations[line["id"]] = round(info.frames / info.samplerate, 3)
    print(f"{line['id']:<17} {durations[line['id']]:6.2f}s  gain {gain:5.2f}")

DURATIONS.write_text(json.dumps(durations, indent=2))
print(f"total narration {sum(durations.values()):.1f}s, voice {VOICE}, speed {SPEED}, rms {TARGET_RMS_DBFS} dBFS")
