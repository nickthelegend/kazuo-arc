"""Final pass on the pre-selfie cut: USDC spelled out in the narration, the live selfie at real speed
while the builder speaks (only the silent scan is sped up), and the cut trimmed under 4:00.

usage: python3 splice_final5.py <selfie.mp4> <cut_dir> <out_dir>
"""
import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SELFIE, CUT, OUT = (Path(a) for a in sys.argv[1:4])
HERE = Path(__file__).parent
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1440, 900
SPEECH_END, FAST_TO, LIMIT = 52.0, 3.5, 239.5
probe = lambda p: float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True, check=True).stdout)

data = json.loads((CUT / "timeline.json").read_text())
items, total = data["timeline"], data["total"]
start = {x["audio"]: x["start"] for x in items}
after = lambda k: min([x["start"] for x in items if x["start"] > start[k]] + [total])
# narration windows whose line says USDC; i5 sits inside the HyperFrames intro at its authored time
FIXES = [("i5_fix", 26.0, 34.7)] + [(f"{k}_fix", start[k], after(k)) for k in ["pay", "settlement", "earnings"]]
SEGMENTS = [(0.0, start["providers"]), (start["privy"], start["selfie"]), None, (start["compose"], start["explain_receipts"]), (start["outro"], total)]
selfie_total = probe(SELFIE)
fast = (selfie_total - SPEECH_END) / FAST_TO
selfie_len = SPEECH_END + FAST_TO
expected = sum(b - a for s in SEGMENTS if s for a, b in [s]) + selfie_len
if expected > LIMIT:
    raise SystemExit(f"OVER_LIMIT {expected:.1f}s")

caption = "Real World ID Selfie Check in World App, recorded live"
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
mute = "+".join(f"between(t,{a:.3f},{b:.3f})" for _, a, b in FIXES)
main = [s for s in SEGMENTS if s]
for name, burned in [("kazuo-demo.mp4", True), ("kazuo-demo-clean.mp4", False)]:
    fc = [f"[0:a]{anorm},volume=volume=0:enable='{mute}'[base]"]
    fix_inputs = []
    for i, (fid, a, b) in enumerate(FIXES):
        wav = HERE / "audio" / f"{fid}.wav"
        tempo = max(1.0, probe(wav) / (b - a - 0.2))
        fix_inputs += ["-i", str(wav)]
        fc.append(f"[{3 + i}:a]{anorm},atempo={tempo:.4f},adelay={int((a + 0.05) * 1000)}:all=1[f{i}]")
    fc.append("[base]" + "".join(f"[f{i}]" for i in range(len(FIXES))) + f"amix=inputs={len(FIXES) + 1}:normalize=0:duration=first[mix]")
    fc.append(f"[0:v]split={len(main)}" + "".join(f"[vs{j}]" for j in range(len(main))))
    fc.append(f"[mix]asplit={len(main)}" + "".join(f"[as{j}]" for j in range(len(main))))
    for j, (a, b) in enumerate(main):
        fc.append(f"[vs{j}]trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS,{norm}[v{j}]")
        fc.append(f"[as{j}]atrim=start={a:.3f}:end={b:.3f},asetpts=PTS-STARTPTS[a{j}]")
    fc.append(f"[1:v]split=2[s1][s2];[s1]trim=end={SPEECH_END},setpts=PTS-STARTPTS,{norm}[sva];"
              f"[s2]trim=start={SPEECH_END},setpts=(PTS-STARTPTS)/{fast:.4f},{norm},trim=duration={FAST_TO}[svb];[sva][svb]concat=n=2:v=1:a=0[svc]")
    fc.append(f"[svc][2:v]overlay={(W - img.width) // 2}:{H - img.height - 44}[sv]" if burned else "[svc]null[sv]")
    fc.append(f"[1:a]asplit=2[sa1][sa2];[sa1]atrim=end={SPEECH_END},asetpts=PTS-STARTPTS,{anorm}[saa];"
              f"[sa2]atrim=start={SPEECH_END},asetpts=PTS-STARTPTS,atempo={fast:.4f},{anorm},apad,atrim=duration={FAST_TO}[sab];[saa][sab]concat=n=2:v=0:a=1[sa]")
    order, j = "", 0
    for s in SEGMENTS:
        if s:
            order += f"[v{j}][a{j}]"
            j += 1
        else:
            order += "[sv][sa]"
    fc.append(f"{order}concat=n={len(SEGMENTS)}:v=1:a=1[v][a]")
    dst = OUT / name
    (OUT / "final5.filter").write_text(";".join(fc))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(CUT / name), "-i", str(SELFIE), "-i", str(plate), *fix_inputs,
                    "-filter_complex_script", str(OUT / "final5.filter"), "-map", "[v]", "-map", "[a]",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dst)], check=True)
    print(f"{dst} {probe(dst):.2f}s")

offsets, t = [], 0.0
for s in SEGMENTS:
    if s:
        offsets.append((s[0], s[1], t))
        t += s[1] - s[0]
    else:
        selfie_at = t
        t += selfie_len
remap = lambda x: next((x - a + o for a, b, o in offsets if a - 0.05 <= x < b), None)

stamp_re = r"(\d+):(\d+):(\d+),(\d+)"
to_s = lambda m: int(m[0]) * 3600 + int(m[1]) * 60 + int(m[2]) + int(m[3]) / 1000
fmt = lambda s: f"{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(s % 60):02d},{int(round((s % 1) * 1000)) % 1000:03d}"
cues = []
for block in (CUT / "kazuo-demo.srt").read_text().strip().split("\n\n"):
    lines = block.splitlines()
    a, b = re.findall(stamp_re, lines[1])
    s, e = to_s(a), to_s(b)
    ns = remap(s)
    if ns is None:
        continue
    seg = next(x for x in offsets if x[0] - 0.05 <= s < x[1])
    cues.append((ns, min(e, seg[1]) - seg[0] + seg[2], " ".join(lines[2:])))
cues.append((selfie_at + 0.1, selfie_at + selfie_len - 0.1, caption))
cues.sort()
(OUT / "kazuo-demo.srt").write_text("\n\n".join(f"{i}\n{fmt(s)} --> {fmt(e)}\n{t}" for i, (s, e, t) in enumerate(cues, 1)) + "\n")

tl = [dict(x, start=remap(x["start"])) for x in items if x["audio"] != "selfie" and remap(x["start"]) is not None]
tl.append({"audio": "selfie", "start": selfie_at})
tl.sort(key=lambda x: x["start"])
data.update(timeline=tl, total=probe(OUT / "kazuo-demo.mp4"), selfie={"source": str(SELFIE), "real_speed_until": SPEECH_END, "scan_speed": round(fast, 2)}, usdc_fixed=[f[0] for f in FIXES])
(OUT / "timeline.json").write_text(json.dumps(data, indent=1))
print(f"FINAL5 selfie at {selfie_at:.2f}s ({SPEECH_END}s real speed + scan {fast:.1f}x); USDC re-voiced {len(FIXES)} lines; total {data['total']:.1f}s")
