// Submission images: real product screenshots (real Chrome, live app), plus a logo and a cover built from the real mark.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const OLD = "/private/tmp/claude-501/-Volumes-Extreme-SSD-Projects-xorv-arc/c503cf8b-a195-48c4-922d-de4468179288/scratchpad/video";
const { chromium } = createRequire(`${OLD}/package.json`)("playwright-core");
const { createWallet, WALLET_INIT_SCRIPT } = await import(`${OLD}/wallet.mjs`);

const REPO = "/Volumes/Extreme SSD/Projects/xorv-arc";
const OUT = `${REPO}/demo/submission`;
fs.mkdirSync(OUT, { recursive: true });
const LANDING = "https://kazuo-arc.vercel.app/";
const APP = "https://kazuo-arc-app.vercel.app/";
const JOB = "job_ytLeQpol5gve";
const SETTLEMENT = "0x6f660f95f4c608a87b0583d0271e750d0017f1956420a1cb6b11a3ccd4fc4acf";
const done = [];

const browser = await chromium.launch({ channel: "chrome", headless: true });
async function ctx(withWallet = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  if (withWallet) {
    const wallet = createWallet();
    await context.exposeBinding("__kazuoWallet", (_s, m, p) => wallet.handle(m, p));
    await context.addInitScript(WALLET_INIT_SCRIPT);
  }
  const page = await context.newPage();
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  return { context, page };
}
async function shot(name, fn, withWallet = false) {
  const { context, page } = await ctx(withWallet);
  try {
    await fn(page);
    await page.screenshot({ path: path.join(OUT, name) });
    done.push(name);
    console.log(`OK ${name}`);
  } catch (err) {
    console.log(`FAIL ${name}: ${String(err).slice(0, 200)}`);
  } finally {
    await context.close();
  }
}

await shot("01-landing-hero.png", async (p) => {
  await p.goto(LANDING, { waitUntil: "networkidle" });
  await p.getByText("Your AI subscription").first().waitFor();
  await p.waitForTimeout(1500);
});

await shot("02-landing-live-receipts.png", async (p) => {
  await p.goto(LANDING, { waitUntil: "networkidle" });
  await p.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; document.getElementById("ledger").scrollIntoView(); window.scrollBy(0, -60); });
  await p.waitForFunction(() => document.querySelectorAll('#ledger a[href*="/tx/"]').length > 0, null, { timeout: 30000 });
  await p.waitForTimeout(1500);
});

await shot("03-job-board-live-provider.png", async (p) => {
  await p.goto(APP, { waitUntil: "networkidle" });
  await p.getByText(/[1-9]\d* provider\(s\) live/).first().waitFor({ timeout: 30000 });
  await p.waitForTimeout(1500);
});

await shot("04-claude-code-quote.png", async (p) => {
  await p.goto(APP, { waitUntil: "networkidle" });
  await p.getByText(/[1-9]\d* provider\(s\) live/).first().waitFor({ timeout: 30000 });
  await p.getByRole("button", { name: /^Model:/ }).click();
  await p.getByRole("option", { name: /Claude Code/ }).first().click();
  const max = p.getByRole("textbox", { name: /Most you.ll pay/ });
  await max.click();
  await p.keyboard.press("Meta+A");
  await p.keyboard.type("0.25");
  await p.getByRole("textbox", { name: "What needs doing?" }).click();
  await p.keyboard.type("Write a one-line bash command that prints the five largest files in the current directory.", { delay: 5 });
  await p.getByRole("button", { name: "Get a quote" }).click();
  const pay = p.getByRole("button", { name: /^Pay \$/ });
  await pay.waitFor({ timeout: 30000 });
  await p.evaluate(() => window.scrollTo(0, 200));
  await p.waitForTimeout(800);
});

await shot("05-completed-job-onchain-receipt.png", async (p) => {
  await p.goto(`${APP}jobs/${JOB}`, { waitUntil: "networkidle" });
  await p.getByText("Completed").first().waitFor({ timeout: 30000 });
  await p.getByRole("link", { name: /View on-chain receipt/ }).first().waitFor({ timeout: 30000 });
  await p.waitForTimeout(800);
});

await shot("06-arcscan-usdc-settlement.png", async (p) => {
  await p.goto(`https://testnet.arcscan.app/tx/${SETTLEMENT}`, { waitUntil: "domcontentloaded" });
  await p.getByText(/Success/i).first().waitFor({ timeout: 60000 });
  await p.waitForTimeout(2500);
});

await shot("07-world-id-selfie-check.png", async (p) => {
  await p.goto(APP, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.locator("#privy-modal-content").waitFor({ timeout: 20000 });
  await p.getByText("Continue with a wallet").click();
  const demo = p.locator("#privy-modal-content button", { hasText: "Kazuo Demo Wallet" }).first();
  await demo.waitFor({ timeout: 20000 });
  await demo.click();
  await p.locator('button[aria-label^="Wallet 0x"]').first().waitFor({ timeout: 40000 });
  await p.waitForTimeout(1000);
  await p.locator('button[aria-label^="Wallet 0x"]').first().click();
  const verify = p.getByRole("button", { name: /Verify you.re human/ });
  await verify.waitFor({ timeout: 15000 });
  await verify.click();
  await p.getByText("Connect your World ID").first().waitFor({ timeout: 30000 });
  await p.waitForTimeout(1500);
}, true);

await shot("08-network-receipts-from-chain.png", async (p) => {
  await p.goto(`${APP}network`, { waitUntil: "networkidle" });
  await p.getByText("Receipts from the chain").first().waitFor({ timeout: 30000 });
  await p.waitForFunction(() => /job_[A-Za-z0-9_-]{12}/.test(document.body.innerText), null, { timeout: 30000 });
  await p.waitForTimeout(1000);
});

// ---------------------------------------------------------------- logo and cover from the real mark
const mark = fs.readFileSync(`${REPO}/apps/app/public/brand/kazuo-mark.svg`, "utf8").replace(/width="64" height="64"/, 'width="100%" height="100%"');
const bg = `background:radial-gradient(120% 120% at 20% 10%,#16123a 0%,#070a14 55%,#05070A 100%)`;

{
  const context = await browser.newContext({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setContent(`<html><body style="margin:0;width:512px;height:512px;${bg};display:flex;align-items:center;justify-content:center"><div style="width:340px;height:340px">${mark}</div></body></html>`);
  await page.screenshot({ path: path.join(OUT, "logo-512.png") });
  await context.close();
  done.push("logo-512.png");
  console.log("OK logo-512.png");
}

{
  const inset = fs.existsSync(path.join(OUT, "05-completed-job-onchain-receipt.png"))
    ? `data:image/png;base64,${fs.readFileSync(path.join(OUT, "05-completed-job-onchain-receipt.png")).toString("base64")}`
    : null;
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setContent(`<html><body style="margin:0;width:1920px;height:1080px;overflow:hidden;${bg};font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',Helvetica,Arial,sans-serif;color:#EAF2FF;position:relative">
    <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(61,220,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(61,220,255,.05) 1px,transparent 1px);background-size:60px 60px"></div>
    <div style="position:absolute;left:130px;top:230px;width:820px">
      <div style="display:flex;align-items:center;gap:28px"><div style="width:120px;height:120px">${mark}</div><div style="font-size:120px;font-weight:800;letter-spacing:-.05em">Kazuo</div></div>
      <div style="margin-top:44px;font-size:56px;font-weight:700;line-height:1.12;letter-spacing:-.03em">Sell your idle AI subscription<br/>one job at a time.</div>
      <div style="margin-top:28px;font-size:30px;line-height:1.4;color:#9FB3C8">Every job paid in USDC on Arc over x402 —<br/>straight from buyer to provider, zero gas for the buyer.</div>
      <div style="margin-top:48px;display:flex;gap:16px;flex-wrap:wrap">${["Arc · USDC · x402", "World AgentKit", "World ID Selfie Check", "Privy"].map((t) => `<div style="padding:14px 26px;border:1.5px solid rgba(61,220,255,.45);border-radius:999px;font-size:26px;color:#CFE8FF;background:rgba(61,220,255,.06)">${t}</div>`).join("")}</div>
    </div>
    ${inset ? `<div style="position:absolute;right:-120px;top:170px;width:980px;border-radius:22px;overflow:hidden;border:1.5px solid rgba(61,220,255,.35);box-shadow:0 40px 120px rgba(0,0,0,.6),0 0 80px rgba(76,155,255,.18);transform:perspective(1800px) rotateY(-14deg) rotateX(4deg)"><img src="${inset}" style="display:block;width:100%"/></div>` : ""}
    <div style="position:absolute;left:130px;bottom:70px;font-size:24px;color:#6F86A0;font-family:'SF Mono',Menlo,monospace">kazuo-arc.vercel.app · ETHOnline 2026</div>
  </body></html>`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "cover-1920x1080.png") });
  await context.close();
  done.push("cover-1920x1080.png");
  console.log("OK cover-1920x1080.png");
}

await browser.close();
console.log(`DONE ${done.length} images in ${OUT}`);
