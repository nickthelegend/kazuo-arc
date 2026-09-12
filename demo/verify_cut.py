"""Check the finished cut: a frame from every clip, blank frames, and silences over 2.5s.

usage: python3 verify_cut.py <out_dir>
"""
import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(sys.argv[1])
cut = OUT / "kazuo-demo.mp4"
timeline = json.loads((OUT / "timeline.json").read_text())
(OUT / "check").mkdir(exist_ok=True)

frames = []
for item in timeline["timeline"]:
    t = item["start"] + item["duration"] * 0.55
    path = OUT / "check" / f"{item['n']:02d}-{item['audio']}.jpg"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t:.2f}", "-i", str(cut), "-frames:v", "1", "-vf", "scale=480:-1", str(path)], check=True)
    frames.append(path)

ims = [Image.open(p) for p in frames]
w, h = ims[0].size
cols = 4
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (w * cols, (h + 20) * rows), "black")
draw = ImageDraw.Draw(sheet)
for i, (p, im) in enumerate(zip(frames, ims)):
    x, y = (i % cols) * w, (i // cols) * (h + 20)
    sheet.paste(im, (x, y + 20))
    draw.text((x + 6, y + 3), p.stem, fill="white")
sheet.save(OUT / "check" / "cut-contact.jpg")

probe = subprocess.run(
    ["ffmpeg", "-v", "info", "-i", str(cut), "-vf", "blackdetect=d=0.5:pix_th=0.05", "-af", "silencedetect=noise=-45dB:d=2.5", "-f", "null", "-"],
    capture_output=True, text=True,
).stderr
blacks = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", probe)
silences = re.findall(r"silence_start: ([\d.]+)", probe)
ends = re.findall(r"silence_end: ([\d.]+) \| silence_duration: ([\d.]+)", probe)
print(f"cut {timeline['total']:.1f}s, {len(timeline['timeline'])} clips, {len(timeline['cues'])} caption cues")
print("black stretches ≥0.5s:", blacks or "none")
print("silences ≥2.5s:", list(zip(silences, ends)) or "none")
print("contact sheet:", OUT / "check" / "cut-contact.jpg")
