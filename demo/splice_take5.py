"""Insert take 5's terminal + earnings beats into a finished cut, right after its receipt beat.

usage: python3 splice_take5.py <take5_dir> <cut_dir>   (rewrites the cut's mp4s, .srt and timeline.json in place)
"""
import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

TAKE, CUT = Path(sys.argv[1]), Path(sys.argv[2])
HERE = Path(__file__).parent
W, H = 1440, 900
run = lambda args: subprocess.run(args, check=True)
probe = lambda p: float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True, check=True).stdout)

vmap = json.loads((TAKE / "video-map.json").read_text())
if vmap["worst_residual"] > 1.0:
    raise SystemExit("REJECT_MAP")
log = (TAKE / "beats.log").read_text()
mark = lambda bid: vmap["a"] + vmap["b"] * int(re.search(rf"DEMO_LINE (\d+) {bid}\b", log).group(1)) / 1000
if not re.search(r"SIGNING_CONFIRMED \d+ terminal 0x[0-9a-f]{64}", log):
    raise SystemExit("NO_TERMINAL_SETTLEMENT")
texts = {x["id"]: x["text"] for x in json.loads((HERE / "narration.json").read_text())}
durs = json.loads((HERE / "durations.json").read_text())
font = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 30)
work = CUT / "take5-insert"
work.mkdir(exist_ok=True)


def chunks(text, limit=72):
    out = []
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        if len(sentence) <= limit:
            out.append(sentence)
            continue
        cur = ""
        for word in sentence.split():
            if len(cur) + len(word) + 1 > limit:
                out.append(cur)
                cur = word
            else:
                cur = f"{cur} {word}".strip()
        out.append(cur)
    return [c for c in out if c]


def plate(text, path):
    w = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textlength(text, font=font)
    img = Image.new("RGBA", (int(w) + 44, 30 + 26), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=8, fill=(0, 0, 0, 215))
    d.text((22, 11), text, font=font, fill=(255, 255, 255, 255))
    img.save(path)
    return img.width, img.height


clips, cues = [], []
for beat, nxt in [("terminal", "earnings"), ("earnings", "account")]:
    v0, v1 = mark(beat), mark(nxt)
    span, target = v1 - v0, durs[beat] + 0.6
    speed = max(span / target, 1.0)
    length = max(span / speed, target)
    parts = chunks(texts[beat])
    total_chars = sum(len(p) for p in parts)
    t, local = 0.15, []
    for i, p in enumerate(parts):
        d = durs[beat] * len(p) / total_chars
        local.append((t, t + d, p, work / f"{beat}-{i}.png"))
        t += d
    base = f"[0:v]setpts=(PTS-STARTPTS)/{speed:.4f},fps=30,scale={W}:{H},setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration=3,trim=duration={length:.3f}[v];[1:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration={length:.3f}[a]"
    for variant in ["clean", "burned"]:
        inputs, fc, last = [], base, "[v]"
        if variant == "burned":
            for j, (s, e, p, png) in enumerate(local):
                pw, ph = plate(p, png)
                inputs += ["-i", str(png)]
                fc += f";{last}[{j + 2}:v]overlay={(W - pw) // 2}:{H - ph - 44}:enable='between(t,{s:.3f},{e:.3f})'[o{j}]"
                last = f"[o{j}]"
        dst = work / f"{beat}-{variant}.mp4"
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{v0:.3f}", "-t", f"{span:.3f}", "-i", str(TAKE / "raw-seekable.mp4"), "-i", str(HERE / "audio" / f"{beat}.wav"), *inputs,
             "-filter_complex", fc, "-map", last, "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "192k", str(dst)])
    clips.append((beat, length))
    cues.append(local)
    print(f"{beat}: video {v0:.2f}-{v1:.2f}s ({span:.1f}s) at {speed:.2f}x -> {length:.2f}s")

timeline = json.loads((CUT / "timeline.json").read_text())
items = timeline["timeline"]
idx = next(i for i, x in enumerate(items) if x["audio"] == "receipt")
insert_at = items[idx + 1]["start"]
added = sum(l for _, l in clips)

for name, variant in [("kazuo-demo.mp4", "burned"), ("kazuo-demo-clean.mp4", "clean")]:
    src = CUT / name
    tmp = CUT / f"tmp-{name}"
    norm = "fps=30,scale=1440:900,setsar=1,format=yuv420p"
    anorm = "aresample=48000,aformat=channel_layouts=stereo"
    fc = (f"[0:v]trim=end={insert_at},setpts=PTS-STARTPTS,{norm}[va];[0:a]atrim=end={insert_at},asetpts=PTS-STARTPTS,{anorm}[aa];"
          f"[1:v]{norm}[vb];[1:a]{anorm}[ab];[2:v]{norm}[vc];[2:a]{anorm}[ac];"
          f"[0:v]trim=start={insert_at},setpts=PTS-STARTPTS,{norm}[vd];[0:a]atrim=start={insert_at},asetpts=PTS-STARTPTS,{anorm}[ad];"
          "[va][aa][vb][ab][vc][ac][vd][ad]concat=n=4:v=1:a=1[v][a]")
    run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-i", str(work / f"terminal-{variant}.mp4"), "-i", str(work / f"earnings-{variant}.mp4"),
         "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(tmp)])
    tmp.replace(src)
    print(f"{src} {probe(src):.2f}s")

stamp_re = r"(\d+):(\d+):(\d+),(\d+)"
to_s = lambda m: int(m[0]) * 3600 + int(m[1]) * 60 + int(m[2]) + int(m[3]) / 1000
fmt = lambda s: f"{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(s % 60):02d},{int(round((s % 1) * 1000)) % 1000:03d}"
old = []
for block in (CUT / "kazuo-demo.srt").read_text().strip().split("\n\n"):
    lines = block.splitlines()
    a, b = re.findall(stamp_re, lines[1])
    old.append((to_s(a), to_s(b), " ".join(lines[2:])))
new = [c for c in old if c[0] < insert_at]
offset = insert_at
for (beat, length), local in zip(clips, cues):
    new += [(offset + s, offset + e, p) for s, e, p, _ in local]
    offset += length
new += [(s + added, e + added, p) for s, e, p in old if s >= insert_at]
(CUT / "kazuo-demo.srt").write_text("\n\n".join(f"{i}\n{fmt(s)} --> {fmt(e)}\n{t}" for i, (s, e, t) in enumerate(new, 1)) + "\n")

t2 = items[: idx + 1] + [{"audio": "terminal", "start": insert_at}, {"audio": "earnings", "start": insert_at + clips[0][1]}] + [dict(x, start=x["start"] + added) for x in items[idx + 1:]]
cli = json.loads((TAKE / "txs.json").read_text())
timeline.update(timeline=t2, total=probe(CUT / "kazuo-demo.mp4"), take5={"cliJobId": cli["cliJobId"], "cliSettlement": cli["cliSettlement"]})
(CUT / "timeline.json").write_text(json.dumps(timeline, indent=1))
print(f"INSERTED take5 terminal+earnings ({added:.1f}s) at {insert_at:.2f}s; total {timeline['total']:.1f}s")
