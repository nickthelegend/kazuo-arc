"""Fit the recorder's clock to the driver's from real screen transitions.

Each ArcScan visit is a white page; it ends when the driver navigates to a dark page, at a logged mark.
The signing overlay is solid blue and comes down at a logged SIGNING_CONFIRMED.

usage: python3 fitmap.py <take_dir> <mark-after-white-1>,<mark-after-white-2>,...
"""
import json
import re
import subprocess
import sys
from pathlib import Path

TAKE = Path(sys.argv[1])
after_white = sys.argv[2].split(",")
raw = TAKE / "raw-seekable.mp4"
fps, w, h = 4, 32, 20
data = subprocess.run(["ffmpeg", "-v", "error", "-i", str(raw), "-vf", f"fps={fps},scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
n = len(data) // (w * h * 3)
kinds = []
for i in range(n):
    f = data[i * w * h * 3:(i + 1) * w * h * 3]
    r, g, b = (sum(f[k::3]) / (w * h) for k in range(3))
    kinds.append("blue" if b > 110 and r < 40 and 40 < g < 90 else "white" if (r + g + b) / 3 > 170 else "dark")
segments, cur, start = [], kinds[0], 0
for i, k in enumerate(kinds[1:], 1):
    if k != cur:
        segments.append((cur, start / fps, i / fps))
        cur, start = k, i
segments.append((cur, start / fps, n / fps))
whites = [s for s in segments if s[0] == "white" and s[2] - s[1] >= 1.0]
blues = [s for s in segments if s[0] == "blue" and s[2] - s[1] >= 1.0]
log = (TAKE / "beats.log").read_text()
mark = lambda bid: int(re.search(rf"DEMO_LINE (\d+) {bid}\b", log).group(1)) / 1000
if len(whites) != len(after_white):
    raise SystemExit(f"EDGES_NOT_FOUND: {len(whites)} white segments {[(round(a,1), round(b,1)) for _, a, b in whites]} for {len(after_white)} expected")
edges = [(f"white→{bid}", mark(bid), seg[2]) for bid, seg in zip(after_white, whites)]
confirmed = re.search(r"SIGNING_CONFIRMED (\d+) pay", log)
if confirmed and blues:
    edges.append(("overlay off", int(confirmed.group(1)) / 1000, blues[0][2]))
xs, ys = [e[1] for e in edges], [e[2] for e in edges]
k = len(xs)
mx, my = sum(xs) / k, sum(ys) / k
b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
a = my - b * mx
res = [(e[0], round(e[2] - (a + b * e[1]), 2)) for e in edges]
worst = max(abs(r) for _, r in res)
for name, drv, vid in edges:
    print(f"  {name:<18} driver {drv:7.2f}s  video {vid:7.2f}s  offset {vid - drv:+.2f}s")
print(f"fit: video = {a:.3f} + {b:.5f} × driver; residuals {res}")
(TAKE / "video-map.json").write_text(json.dumps({"a": a, "b": b, "edges": edges, "residuals": res, "worst_residual": worst, "source": str(raw)}, indent=2))
print("REJECT_MAP" if worst > 1.0 else "MAP_OK", f"worst residual {worst:.2f}s")
