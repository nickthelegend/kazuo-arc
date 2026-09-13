"""Insert the user's real World ID Selfie Check recording and trim the cut under 4:00.

usage: python3 splice_selfie.py <selfie.mp4> <cut_dir> <out_dir>
"""
import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SELFIE, CUT, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
OUT.mkdir(parents=True, exist_ok=True)
W, H, S = 1440, 900, 21.0
LIMIT = 239.0
probe = lambda p: float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True, check=True).stdout)
has_audio = "audio" in subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(SELFIE)], capture_output=True, text=True).stdout

data = json.loads((CUT / "timeline.json").read_text())
items = data["timeline"]
start = {x["audio"]: x["start"] for x in items}
insert_at = start["compose"]
drop_from, drop_to = start["explain_receipts"], start["outro"]
removed = drop_to - drop_from
speed = probe(SELFIE) / S
total_expected = data["total"] - removed + S
if total_expected > LIMIT:
    raise SystemExit(f"OVER_LIMIT {total_expected:.1f}s")

caption = "Real World ID Selfie Check, scanned in World App (sped up)"
font = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 30)
tw = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textlength(caption, font=font)
img = Image.new("RGBA", (int(tw) + 44, 56), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=8, fill=(0, 0, 0, 215))
d.text((22, 11), caption, font=font, fill=(255, 255, 255, 255))
plate = OUT / "selfie-caption.png"
img.save(plate)

norm = f"fps=30,scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p"
anorm = "aresample=48000,aformat=channel_layouts=stereo"
for name, burned in [("kazuo-demo.mp4", True), ("kazuo-demo-clean.mp4", False)]:
    sel_a = f"[1:a]atempo={speed:.4f},{anorm},apad,atrim=duration={S}[sa]" if has_audio else f"anullsrc=r=48000:cl=stereo,atrim=duration={S}[sa]"
    sel_v = f"[1:v]setpts=(PTS-STARTPTS)/{speed:.4f},{norm},trim=duration={S}[sv0]"
    sel_v += f";[sv0][2:v]overlay={(W - img.width) // 2}:{H - img.height - 44}[sv]" if burned else ";[sv0]null[sv]"
    fc = ";".join([
        f"[0:v]trim=end={insert_at},setpts=PTS-STARTPTS,{norm}[v1]", f"[0:a]atrim=end={insert_at},asetpts=PTS-STARTPTS,{anorm}[a1]",
        sel_v, sel_a,
        f"[0:v]trim=start={insert_at}:end={drop_from},setpts=PTS-STARTPTS,{norm}[v2]", f"[0:a]atrim=start={insert_at}:end={drop_from},asetpts=PTS-STARTPTS,{anorm}[a2]",
        f"[0:v]trim=start={drop_to},setpts=PTS-STARTPTS,{norm}[v3]", f"[0:a]atrim=start={drop_to},asetpts=PTS-STARTPTS,{anorm}[a3]",
        "[v1][a1][sv][sa][v2][a2][v3][a3]concat=n=4:v=1:a=1[v][a]",
    ])
    dst = OUT / name
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(CUT / name), "-i", str(SELFIE), "-i", str(plate), "-filter_complex", fc,
                    "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dst)], check=True)
    print(f"{dst} {probe(dst):.2f}s")

stamp_re = r"(\d+):(\d+):(\d+),(\d+)"
to_s = lambda m: int(m[0]) * 3600 + int(m[1]) * 60 + int(m[2]) + int(m[3]) / 1000
fmt = lambda s: f"{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(s % 60):02d},{int(round((s % 1) * 1000)) % 1000:03d}"
cues = []
for block in (CUT / "kazuo-demo.srt").read_text().strip().split("\n\n"):
    lines = block.splitlines()
    a, b = re.findall(stamp_re, lines[1])
    s, e, t = to_s(a), to_s(b), " ".join(lines[2:])
    if s < insert_at:
        cues.append((s, min(e, insert_at), t))
    elif s < drop_from:
        cues.append((s + S, min(e, drop_from) + S, t))
    elif s >= drop_to - 0.05:
        cues.append((s + S - removed, e + S - removed, t))
cues.append((insert_at + 0.1, insert_at + S - 0.1, caption))
cues.sort()
(OUT / "kazuo-demo.srt").write_text("\n\n".join(f"{i}\n{fmt(s)} --> {fmt(e)}\n{t}" for i, (s, e, t) in enumerate(cues, 1)) + "\n")

tl = []
for x in items:
    if x["start"] < insert_at:
        tl.append(x)
    elif x["start"] < drop_from:
        tl.append(dict(x, start=x["start"] + S))
    elif x["start"] >= drop_to - 0.05:
        tl.append(dict(x, start=x["start"] + S - removed))
tl.append({"audio": "selfie_live", "start": insert_at})
tl.sort(key=lambda x: x["start"])
data.update(timeline=tl, total=probe(OUT / "kazuo-demo.mp4"), selfie={"source": str(SELFIE), "speed": round(speed, 3)})
(OUT / "timeline.json").write_text(json.dumps(data, indent=1))
print(f"SELFIE inserted at {insert_at:.2f}s ({speed:.2f}x -> {S}s); removed {removed:.1f}s of explainers/network/node; total {data['total']:.1f}s")
