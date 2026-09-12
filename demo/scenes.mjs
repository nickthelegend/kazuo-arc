// Animated intro, explainer and outro scenes, recorded from HTML in the same real browser.
// Explainers read real values from the take's txs.json and refuse to build without them.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const SCRATCH = "/private/tmp/claude-501/-Volumes-Extreme-SSD-Projects-xorv-arc/c503cf8b-a195-48c4-922d-de4468179288/scratchpad/video";
const { chromium } = createRequire(`${SCRATCH}/package.json`)("playwright-core");
const W = 1440;
const H = 900;
const [, , takeDir, outDir] = process.argv;
const txsPath = path.join(takeDir, "txs.json");
if (!fs.existsSync(txsPath)) throw new Error("NO_TAKE_TXS");
const txs = JSON.parse(fs.readFileSync(txsPath, "utf8"));
for (const k of ["settlement", "receipt", "jobId", "payer", "payTo", "resultHash"]) {
  if (!txs[k]) throw new Error(`NO_TAKE_TXS missing ${k}`);
}
const durations = JSON.parse(fs.readFileSync(path.join(takeDir, "..", "scene-durations.json"), "utf8"));
fs.mkdirSync(outDir, { recursive: true });

const short = (h) => `${h.slice(0, 10)}…${h.slice(-6)}`;
const base = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:${W}px;height:${H}px;overflow:hidden;background:#05070A;color:#EAF2FF;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",Helvetica,Arial,sans-serif}
  .mono{font-family:"SF Mono",Menlo,monospace}
  .in{opacity:0;transform:translateY(26px);animation:rise .9s cubic-bezier(.2,.8,.2,1) forwards}
  @keyframes rise{to{opacity:1;transform:none}}
  @keyframes pop{0%{opacity:0;transform:scale(.8)}100%{opacity:1;transform:scale(1)}}
  @keyframes glow{0%,100%{box-shadow:0 0 0 rgba(61,220,255,0)}50%{box-shadow:0 0 42px rgba(61,220,255,.45)}}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(61,220,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(61,220,255,.06) 1px,transparent 1px);background-size:48px 48px;animation:drift 12s linear infinite}
  @keyframes drift{to{background-position:48px 48px}}
`;

const scenes = {
  intro: `<div class="grid"></div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px">
      <div class="in" style="animation-delay:.1s;width:120px;height:120px;border-radius:30px;background:linear-gradient(135deg,#3DDCFF,#7C5CFF);display:flex;align-items:center;justify-content:center;font-size:66px;font-weight:800;color:#05070A;animation-name:pop;animation-duration:.8s">K</div>
      <div style="display:flex;gap:18px;font-size:112px;font-weight:800;letter-spacing:-.05em">${"Kazuo".split("").map((c, i) => `<span class="in" style="animation-delay:${0.45 + i * 0.09}s">${c}</span>`).join("")}</div>
      <div class="in" style="animation-delay:1.2s;font-size:34px;color:#9FB3C8;letter-spacing:-.01em">Idle AI subscriptions, sold one job at a time</div>
      <div style="display:flex;gap:16px;margin-top:22px">${["Arc · USDC over x402", "World AgentKit + World ID", "Privy wallets"].map((t, i) => `<div class="in" style="animation-delay:${1.8 + i * 0.25}s;padding:12px 22px;border:1px solid rgba(61,220,255,.35);border-radius:999px;font-size:22px;color:#CFE8FF">${t}</div>`).join("")}</div>
    </div>`,
  path: `<div class="grid"></div>
    <div class="in" style="position:absolute;top:70px;width:100%;text-align:center;font-size:46px;font-weight:700;letter-spacing:-.03em">Where one job's money and data go</div>
    <div style="position:absolute;top:250px;left:70px;right:70px;display:flex;justify-content:space-between;align-items:center">
      ${[["Buyer wallet", "signs a USDC authorization"], ["Broker", "quotes, then checks the 402 payment"], ["Facilitator", "relays it and pays the gas"], ["Arc", "USDC moves buyer → provider"], ["Provider node", "runs the job in a sandbox"], ["KazuoLog", "receipt with the result hash"]].map(([t, s], i) => `
        <div class="in" style="animation-delay:${0.6 + i * 0.7}s;width:196px;height:196px;border-radius:24px;border:1.5px solid #3DDCFF;background:rgba(61,220,255,.06);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px;animation:rise .9s cubic-bezier(.2,.8,.2,1) ${0.6 + i * 0.7}s forwards, glow 1.4s ease-in-out ${1.2 + i * 0.7}s 1">
          <div style="font-size:26px;font-weight:700">${t}</div><div style="margin-top:10px;font-size:17px;color:#9FB3C8;line-height:1.35">${s}</div></div>`).join("")}
    </div>
    <div style="position:absolute;top:340px;left:266px;right:266px;height:3px;background:rgba(61,220,255,.18)"></div>
    <div style="position:absolute;top:333px;left:266px;width:16px;height:16px;border-radius:50%;background:#3DDCFF;box-shadow:0 0 18px #3DDCFF;animation:travel 4.4s cubic-bezier(.45,0,.55,1) .9s forwards;opacity:0"></div>
    <style>@keyframes travel{0%{opacity:1;left:266px}100%{opacity:1;left:${W - 282}px}}</style>
    <div class="in mono" style="animation-delay:5s;position:absolute;bottom:130px;width:100%;text-align:center;font-size:22px;color:#9FB3C8">job ${txs.jobId} · paid ${(txs.priceUsdMicros / 1e6).toFixed(2)} USDC · ${short(txs.payer)} → ${short(txs.payTo)}</div>`,
  receipts: `<div class="grid"></div>
    <div class="in" style="position:absolute;top:64px;width:100%;text-align:center;font-size:46px;font-weight:700;letter-spacing:-.03em">This job left two transactions on Arc</div>
    <div style="position:absolute;top:190px;left:90px;right:90px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
      ${[
        ["Settlement", txs.settlement, [["USDC transfer", `${(txs.priceUsdMicros / 1e6).toFixed(2)} USDC`], ["from (buyer)", short(txs.payer)], ["to (provider)", short(txs.payTo)], ["gas paid by", "facilitator"]], "no job id · no answer"],
        ["Receipt", txs.receipt, [["contract", "KazuoLog"], ["job", txs.jobId], ["result sha-256", `${txs.resultHash.slice(0, 16)}…`], ["settlement", short(txs.settlement)]], "no USDC moved"],
      ].map(([title, hash, rows, lacks], i) => `
        <div class="in" style="animation-delay:${0.5 + i * 0.6}s;border:1.5px solid rgba(61,220,255,.4);border-radius:22px;padding:34px;background:rgba(61,220,255,.05)">
          <div style="font-size:34px;font-weight:700">${title}</div>
          <div class="mono" style="margin-top:10px;font-size:19px;color:#3DDCFF">${hash.slice(0, 22)}…${hash.slice(-8)}</div>
          ${rows.map(([k, v], j) => `<div class="in" style="animation-delay:${1.3 + i * 0.6 + j * 0.28}s;display:flex;justify-content:space-between;margin-top:18px;font-size:22px"><span style="color:#9FB3C8">${k}</span><span class="mono">${v}</span></div>`).join("")}
          <div class="in" style="animation-delay:${2.8 + i * 0.6}s;margin-top:26px;font-size:20px;color:#FFB86B">◦ ${lacks}</div>
        </div>`).join("")}
    </div>
    <div class="in" style="animation-delay:4.2s;position:absolute;bottom:120px;width:100%;text-align:center;font-size:24px;color:#9FB3C8">One pays. One proves what was paid for. Both on testnet.arcscan.app.</div>`,
  attack: `<div class="grid"></div>
    <div class="in" style="position:absolute;top:64px;width:100%;text-align:center;font-size:46px;font-weight:700;letter-spacing:-.03em">The bot-farm attack, and what World adds</div>
    <div style="position:absolute;top:200px;left:110px;right:110px;display:grid;grid-template-columns:repeat(3,1fr);gap:34px">
      ${[
        ["What the attacker needs", "Hundreds of fake nodes, to win jobs and farm a track record."],
        ["What it gets", "Each fake node can sign an AgentKit proof — but AgentBook finds no human behind its address."],
        ["Why that ends it", "Human-backed nodes win ties, one human backs at most three nodes, and buyers can require human-backed only."],
      ].map(([t, s], i) => `<div class="in" style="animation-delay:${0.6 + i * 1.1}s;border-radius:22px;border:1.5px solid ${i === 2 ? "#50F0C8" : "rgba(61,220,255,.4)"};padding:32px;background:rgba(61,220,255,.05)"><div style="font-size:30px;font-weight:700">${t}</div><div style="margin-top:18px;font-size:23px;line-height:1.45;color:#CFE0F2">${s}</div></div>`).join("")}
    </div>
    <div class="in" style="animation-delay:4.4s;position:absolute;bottom:120px;width:100%;text-align:center;font-size:24px;color:#9FB3C8">World ID Selfie Check is the second route to the human label.</div>`,
  outro: `<div class="grid"></div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px">
      <div style="display:flex;gap:16px;font-size:92px;font-weight:800;letter-spacing:-.05em">${"Thanks for watching".split(" ").map((w, i) => `<span class="in" style="animation-delay:${0.2 + i * 0.3}s">${w}</span>`).join("")}</div>
      <div class="in mono" style="animation-delay:1.3s;font-size:26px;color:#3DDCFF">kazuo-arc.vercel.app · github.com/nickthelegend/kazuo-arc</div>
      <div class="in" style="animation-delay:1.8s;font-size:24px;color:#9FB3C8">Built on Arc · World · Privy — ETHOnline 2026</div>
    </div>
    <style>body{animation:out .8s ease-in ${Math.max(2.5, durations.outro - 0.9)}s forwards}@keyframes out{to{opacity:0;transform:scale(.97)}}</style>`,
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const [name, html] of Object.entries(scenes)) {
  const seconds = durations[name];
  if (!seconds) throw new Error(`NO_SCENE_DURATION ${name}`);
  const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: path.join(outDir, name), size: { width: W, height: H } } });
  const page = await context.newPage();
  await page.setContent(`<!doctype html><html><head><style>${base}</style></head><body>${html}</body></html>`);
  await page.waitForTimeout(Math.round(seconds * 1000) + 600);
  const video = page.video();
  await context.close();
  fs.renameSync(await video.path(), path.join(outDir, `${name}.webm`));
  fs.rmSync(path.join(outDir, name), { recursive: true, force: true });
  console.log(`scene ${name} ${seconds}s`);
}
await browser.close();
