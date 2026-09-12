"""Approve the take, then cut it from the beat log.

usage: python3 assemble.py <take_dir> <scenes_dir> <out_dir>
"""
import json
import math
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
TAKE = Path(sys.argv[1])
SCENES = Path(sys.argv[2])
OUT = Path(sys.argv[3])
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "clips").mkdir(exist_ok=True)
(OUT / "cues").mkdir(exist_ok=True)
(OUT / "frames").mkdir(exist_ok=True)

W, H, FPS = 1440, 900, 30
BREATH = 0.45
RAMP_CAP = 3.0
FONT = "/System/Library/Fonts/HelveticaNeue.ttc"


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"FFMPEG_FAILED {' '.join(cmd[:6])}…\n{r.stderr[-1500:]}")
    return r.stdout


def probe_duration(path):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)]).strip())


# ------------------------------------------------------------------ PHASE A: approve the take
beats_log = TAKE / "beats.log"
txs = json.loads((TAKE / "txs.json").read_text())
raw = Path(txs["rawVideo"])
if not raw.exists():
    raise SystemExit("REJECT: raw video missing")
if raw.stat().st_mtime < beats_log.stat().st_mtime - 5:
    raise SystemExit("STALE_SOURCE: raw video is older than the beat log")
if txs.get("outcome") != "complete":
    raise SystemExit(f"REJECT: take outcome {txs.get('outcome')}: {txs.get('error')}")

plan = [row.split("|")[1].strip() for row in (HERE / "recording.md").read_text().splitlines() if re.match(r"^\| [a-z]+ \|", row)]
marks = []
for text in beats_log.read_text().splitlines():
    m = re.match(r"DEMO_LINE (\d+) (\S+)(?: (\S+))?", text)
    if m:
        marks.append({"ms": int(m.group(1)), "id": m.group(2), "flag": m.group(3)})
ids = [m["id"] for m in marks]
if ids != plan:
    raise SystemExit(f"REJECT: marks {ids} do not match recording.md {plan}")
if any(b["ms"] <= a["ms"] for a, b in zip(marks, marks[1:])):
    raise SystemExit("REJECT: marks out of order")
if "SIGNING_CONFIRMED" not in beats_log.read_text():
    raise SystemExit("REJECT: signing beat has no on-chain confirmation")
for key in ("settlement", "receipt", "jobId"):
    if not re.fullmatch(r"0x[0-9a-fA-F]{64}|job_[A-Za-z0-9_-]+", str(txs.get(key, ""))):
        raise SystemExit(f"NO_TAKE_TXS: {key}")
if txs.get("consoleErrors"):
    print("NOTE console errors in take:", json.dumps(txs["consoleErrors"])[:600])

raw_duration = probe_duration(raw)
durations = json.loads((HERE / "durations.json").read_text())
scene_durations = json.loads((HERE / "scene-durations.json").read_text())
print(f"APPROVE checks passed: {len(marks)} marks, raw {raw_duration:.1f}s, settlement {txs['settlement']}, receipt {txs['receipt']}")

# frames to look at: one per beat, mid-span
for i, mark in enumerate(marks):
    end = marks[i + 1]["ms"] if i + 1 < len(marks) else raw_duration * 1000
    t = (mark["ms"] + end) / 2000
    run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t:.2f}", "-i", str(raw), "-frames:v", "1", "-vf", "scale=720:-1", str(OUT / "frames" / f"{i:02d}-{mark['id']}.jpg")])


# ------------------------------------------------------------------ captions
font = ImageFont.truetype(FONT, 30)


def chunks(text, limit=72):
    parts = []
    for sentence in re.split(r"(?<=[.!?])\s+", text.strip()):
        if len(sentence) <= limit:
            parts.append(sentence)
            continue
        buf = ""
        for clause in re.split(r"(?<=,)\s+", sentence):
            if len(clause) > limit:
                for word in clause.split():
                    if len(buf) + len(word) + 1 > limit and buf:
                        parts.append(buf)
                        buf = word
                    else:
                        buf = f"{buf} {word}".strip()
            elif len(buf) + len(clause) + 1 > limit and buf:
                parts.append(buf)
                buf = clause
            else:
                buf = f"{buf} {clause}".strip()
        if buf:
            parts.append(buf)
    return parts


def cue_png(text, path):
    draw = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    w = draw.textlength(text, font=font)
    if w > W - 160:
        raise SystemExit(f"CAPTION_WRAPS: '{text}' is {w:.0f}px on one line")
    pad_x, pad_y = 22, 12
    img = Image.new("RGBA", (int(w) + pad_x * 2, 30 + pad_y * 2 + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=8, fill=(0, 0, 0, 215))
    d.text((pad_x, pad_y), text, font=font, fill=(255, 255, 255, 255))
    img.save(path)
    return img.width, img.height


# ------------------------------------------------------------------ PHASE D: clips in assembly order
narration = {l["id"]: l["text"] for l in json.loads((HERE / "narration.json").read_text())}
narration.update({l["id"]: l["text"] for l in json.loads((HERE / "narration-scenes.json").read_text())})
mark_index = {m["id"]: i for i, m in enumerate(marks)}

ORDER = [
    ("scene", "intro", "intro"),
    ("beat", "landing", "landing"),
    ("beat", "receipts", "receipts"),
    ("beat", "contract", "contract"),
    ("beat", "board", "board"),
    ("beat", "providers", "providers"),
    ("scene", "attack", "explain_attack"),
    ("beat", "privy", "privy"),
    ("beat", "selfie", "selfie"),
    ("beat", "compose", "compose"),
    ("beat", "pay", "pay"),
    ("beat", "job", "job"),
    ("beat", "settlement", "settlement"),
    ("beat", "receipt", "receipt"),
    ("scene", "receipts", "explain_receipts"),
    ("scene", "path", "explain_path"),
    ("beat", "network", "network"),
    ("beat", "node", "node"),
    ("scene", "outro", "outro"),
]

timeline = []
for n, (kind, source, audio_id) in enumerate(ORDER):
    audio = HERE / "audio" / f"{audio_id}.wav"
    if not audio.exists():
        raise SystemExit(f"NO_SLIDE_AUDIO {audio_id}")
    speak = durations.get(audio_id) or scene_durations.get(audio_id)
    target = speak + BREATH
    clip = OUT / "clips" / f"{n:02d}-{audio_id}.mp4"
    if kind == "beat":
        i = mark_index[source]
        start = marks[i]["ms"] / 1000
        end = marks[i + 1]["ms"] / 1000 if i + 1 < len(marks) else raw_duration
        span = end - start
        speed = 1.0
        if span > target:
            speed = min(span / target, RAMP_CAP)
            if span / speed > target + 5:
                speed = span / (target + 5)
        length = span / speed
        pad = max(0.0, target - length)
        vf = f"setpts=(PTS-STARTPTS)/{speed:.4f},fps={FPS},scale={W}:{H}:flags=lanczos,tpad=stop_mode=clone:stop_duration={pad:.3f},format=yuv420p"
        run(["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.3f}", "-t", f"{span:.3f}", "-i", str(raw), "-i", str(audio),
             "-filter_complex", f"[0:v]{vf}[v];[1:a]aresample=48000,apad[a]", "-map", "[v]", "-map", "[a]",
             "-t", f"{max(length + pad, target):.3f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-r", str(FPS),
             "-c:a", "aac", "-b:a", "192k", "-ac", "2", str(clip)])
        note = f"span {span:.1f}s → {length + pad:.1f}s (x{speed:.2f}, hold {pad:.2f}s)"
    else:
        src = SCENES / f"{source}.webm"
        if not src.exists():
            raise SystemExit(f"NO_SCENE {source}")
        run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-i", str(audio),
             "-filter_complex", f"[0:v]fps={FPS},scale={W}:{H},tpad=stop_mode=clone:stop_duration=2,format=yuv420p[v];[1:a]aresample=48000,apad[a]",
             "-map", "[v]", "-map", "[a]", "-t", f"{target:.3f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-r", str(FPS),
             "-c:a", "aac", "-b:a", "192k", "-ac", "2", str(clip)])
        note = "animated scene"
    has_audio = "audio" in run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(clip)])
    if not has_audio:
        raise SystemExit(f"NO_SLIDE_AUDIO {clip.name}")
    timeline.append({"n": n, "kind": kind, "source": source, "audio": audio_id, "clip": str(clip), "speak": speak, "note": note})
    print(f"{n:02d} {kind:<5} {audio_id:<17} {note}")

# measure each normalised clip after the mux, then place cues on that clock
clock = 0.0
cues = []
for item in timeline:
    real = probe_duration(item["clip"])
    item["start"], item["duration"] = clock, real
    parts = chunks(narration[item["audio"]])
    total_chars = sum(len(p) for p in parts)
    t = clock + 0.05
    for p in parts:
        share = item["speak"] * len(p) / total_chars
        cues.append({"start": t, "end": t + share, "text": p})
        t += share
    clock += real

concat = OUT / "concat.txt"
concat.write_text("".join(f"file '{t['clip']}'\n" for t in timeline))
clean = OUT / "kazuo-demo-clean.mp4"
run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", "-movflags", "+faststart", str(clean)])

# captions: .srt + burned master
def ts(sec):
    ms = int(round(sec * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"

(OUT / "kazuo-demo.srt").write_text("".join(f"{i + 1}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}\n\n" for i, c in enumerate(cues)))
inputs, filters, last = [], [], "[0:v]"
for i, c in enumerate(cues):
    png = OUT / "cues" / f"{i:03d}.png"
    cw, ch = cue_png(c["text"], png)
    inputs += ["-i", str(png)]
    x, y = (W - cw) // 2, H - ch - 44
    out = f"[v{i}]"
    filters.append(f"{last}[{i + 1}:v]overlay={x}:{y}:enable='between(t,{c['start']:.3f},{c['end']:.3f})'{out}")
    last = out
burned = OUT / "kazuo-demo.mp4"
(OUT / "overlay.filter").write_text(";".join(filters))
run(["ffmpeg", "-y", "-v", "error", "-i", str(clean), *inputs, "-filter_complex_script", str(OUT / "overlay.filter"), "-map", last, "-map", "0:a",
     "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-c:a", "copy", "-movflags", "+faststart", str(burned)])

total = probe_duration(burned)
(OUT / "timeline.json").write_text(json.dumps({"timeline": timeline, "cues": cues, "total": total, "txs": {k: txs[k] for k in ("jobId", "settlement", "receipt", "payer", "payTo", "resultHash")}}, indent=2))
print(f"FINAL {burned} {total:.1f}s · clean {clean} · {len(cues)} cues")
