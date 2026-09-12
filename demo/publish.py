"""Publish kit from the FINISHED cut's own timeline. usage: python3 publish.py <out_dir>"""
import json
import sys
from pathlib import Path

OUT = Path(sys.argv[1])
timeline_path = OUT / "timeline.json"
if not timeline_path.exists():
    raise SystemExit("NO_TIMELINE: assemble the cut first")
data = json.loads(timeline_path.read_text())
tl, total, txs = data["timeline"], data["total"], data["txs"]

CHAPTERS = [
    ("intro", "What Kazuo is"),
    ("landing", "Idle AI subscriptions, sold per job"),
    ("board", "The job board and a live provider"),
    ("explain_attack", "World AgentKit: human-backed nodes"),
    ("privy", "Privy sign-in with a wallet"),
    ("selfie", "World ID Selfie Check"),
    ("compose", "Quote a Claude Code job"),
    ("pay", "Pay with x402, settle on Arc"),
    ("settlement", "The transactions on ArcScan"),
    ("explain_path", "How the payment flows"),
    ("network", "Network and the provider node"),
    ("outro", "Thanks for watching"),
]
start_of = {item["audio"]: item["start"] for item in tl}
chapters = []
for audio_id, title in CHAPTERS:
    if audio_id not in start_of:
        raise SystemExit(f"NO_CHAPTER_ANCHOR {audio_id}")
    chapters.append((start_of[audio_id], title))
chapters.sort()
if chapters[0][0] > 0.5:
    raise SystemExit("CHAPTERS: first chapter must start at 0:00")
chapters[0] = (0.0, chapters[0][1])
merged = []
for i, (t, title) in enumerate(chapters):
    nxt = chapters[i + 1][0] if i + 1 < len(chapters) else total
    if merged and nxt - t < 10:
        continue
    merged.append((t, title))
if len(merged) < 3:
    raise SystemExit("CHAPTERS: fewer than three")
for i, (t, _) in enumerate(merged):
    nxt = merged[i + 1][0] if i + 1 < len(merged) else total
    if nxt - t < 10:
        raise SystemExit(f"CHAPTERS: '{merged[i][1]}' is under 10s")

stamp = lambda s: f"{int(s // 60)}:{int(s % 60):02d}"
arcscan = "https://testnet.arcscan.app"
kit = f"""# Kazuo — ETHOnline 2026 demo

**Title:** Kazuo — sell idle AI subscriptions per job, paid in USDC on Arc (World + Privy)

**Runtime:** {stamp(total)}

## Description
Kazuo turns the Claude, Codex or Grok subscription you already pay for into a node that sells compute one job
at a time. A buyer — a person, the CLI, or an AI agent over MCP — gets a quote, signs a USDC authorization
over x402, and the job's payment settles on Arc straight to the provider. Every job leaves an on-chain receipt
in the KazuoLog contract. World AgentKit and World ID Selfie Check mark human-backed nodes; Privy signs people
in with an email or an existing wallet.

## Chapters
{chr(10).join(f"{stamp(t)} {title}" for t, title in merged)}

## Links
- Landing: https://kazuo-arc.vercel.app
- Job board: https://kazuo-arc-app.vercel.app
- Source: https://github.com/nickthelegend/kazuo-arc
- KazuoLog contract: {arcscan}/address/0x383f5153db8bb18c7c25157fb3493645a465eef3
- USDC on Arc testnet: {arcscan}/token/0x3600000000000000000000000000000000000000

## Transactions shown in this video (Arc testnet)
- Job `{txs['jobId']}`
- Settlement (USDC buyer → provider): {arcscan}/tx/{txs['settlement']}
- On-chain receipt (KazuoLog): {arcscan}/tx/{txs['receipt']}
- Buyer wallet `{txs['payer']}` → provider `{txs['payTo']}`
- Result sha-256 `{txs['resultHash']}`
"""
(OUT / "PUBLISH.md").write_text(kit)
print(kit)
