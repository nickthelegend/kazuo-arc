"""Put the HyperFrames intro in front of the finished cut, replacing its drawn intro scene.

usage: python3 splice_intro.py <intro.mp4> <cut_dir> <out_dir>
"""
import json
import re
import subprocess
import sys
from pathlib import Path

INTRO, CUT, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
OUT.mkdir(parents=True, exist_ok=True)
probe = lambda p: float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True, check=True).stdout)
timeline = json.loads((CUT / "timeline.json").read_text())
cut_from = next(x["start"] for x in timeline["timeline"] if x["audio"] == "landing")
intro_len = probe(INTRO)
shift = intro_len - cut_from

for name in ["kazuo-demo.mp4", "kazuo-demo-clean.mp4"]:
    src = CUT / name
    dst = OUT / name
    fc = (
        "[0:v]fps=30,scale=1440:900,setsar=1,format=yuv420p[v0];[0:a]aresample=48000,aformat=channel_layouts=stereo[a0];"
        f"[1:v]trim=start={cut_from},setpts=PTS-STARTPTS,fps=30,scale=1440:900,setsar=1,format=yuv420p[v1];"
        f"[1:a]atrim=start={cut_from},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[a1];"
        "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]"
    )
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(INTRO), "-i", str(src), "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dst)], check=True)
    print(f"{dst} {probe(dst):.2f}s")

# .srt: sentence cues for the intro, then the cut's own cues shifted past it
INTRO_LINES = [
    (0.3, 4.075, "You pay for Claude every month. Most of the day, it sits idle."),
    (4.8, 5.12, "Someone else needs that exact capacity, and has to buy a whole plan to get it."),
    (10.3, 7.147, "With Kazuo, one command turns your subscription into a provider node, selling work one job at a time."),
    (17.85, 7.744, "A buyer describes the work. The network answers with a 402, and exactly what it costs. Nothing is paid yet."),
    (26.0, 8.277, "The buyer signs one USDC authorization. It settles on Arc, straight to the provider, and the facilitator pays the gas."),
    (34.7, 8.661, "Every job leaves a receipt in the KazuoLog contract on Arc testnet. The payment, the provider, and a hash of the result."),
    (43.8, 8.128, "Providers prove they are human with World ID. People sign in with Privy, and AI agents buy over MCP."),
    (52.35, 4.757, "Kazuo. Idle AI subscriptions, turned into income, on Arc."),
]
cues = []
for start, dur, text in INTRO_LINES:
    parts = [p for p in re.split(r"(?<=[.])\s+", text) if p]
    total = sum(len(p) for p in parts)
    t = start
    for p in parts:
        d = dur * len(p) / total
        cues.append((t, t + d, p))
        t += d
stamp_re = r"(\d+):(\d+):(\d+),(\d+)"
to_s = lambda m: int(m[0]) * 3600 + int(m[1]) * 60 + int(m[2]) + int(m[3]) / 1000
for block in (CUT / "kazuo-demo.srt").read_text().strip().split("\n\n"):
    lines = block.splitlines()
    a, b = re.findall(stamp_re, lines[1])
    s, e = to_s(a), to_s(b)
    if s < cut_from - 0.05:
        continue
    cues.append((s + shift, e + shift, " ".join(lines[2:])))
fmt = lambda s: f"{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(s % 60):02d},{int(round((s % 1) * 1000)) % 1000:03d}"
(OUT / "kazuo-demo.srt").write_text("\n\n".join(f"{i}\n{fmt(s)} --> {fmt(e)}\n{t}" for i, (s, e, t) in enumerate(cues, 1)) + "\n")
tl = [{"audio": "intro", "start": 0.0}] + [dict(x, start=x["start"] + shift) for x in timeline["timeline"] if x["start"] >= cut_from - 0.05]
(OUT / "timeline.json").write_text(json.dumps({"timeline": tl, "total": probe(OUT / "kazuo-demo.mp4"), "txs": timeline["txs"], "intro": str(INTRO), "cut_from": cut_from}, indent=1))
print(f"SPLICED intro {intro_len:.2f}s + cut from {cut_from:.2f}s; {len(cues)} srt cues")
