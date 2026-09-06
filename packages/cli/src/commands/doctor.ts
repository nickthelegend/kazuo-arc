/**
 * `xorv doctor` — every reason this node might not earn, in one screen.
 *
 * Ordered by what actually blocks money: config, then payout account, then the
 * broker, then the agent CLIs, then the optional extras. Each failed check says
 * what to run next, because "✖ USDC not associated" without the fix is just a
 * nicer way of being stuck.
 */

import {
  fetchBalances,
  formatUsd,
  hashscanAccount,
  networkLabel,
  usdcTokenId,
} from "@xorv/protocol";
import { detectAvailable } from "../adapters/index.js";
import { safeMode } from "../adapters/base.js";
import { describeSandbox, detectSandbox, withheldEnvKeys } from "../sandbox.js";
import { configPath, loadConfig, resolveBrokerUrl } from "../config.js";
import { cloudflaredAvailable, CLOUDFLARED_INSTALL_HINT } from "../tunnel.js";
import * as ui from "../ui.js";

type Level = "ok" | "warn" | "bad";

interface Check {
  level: Level;
  label: string;
  detail?: string;
  fix?: string;
}

export async function doctorCommand(): Promise<void> {
  console.log(ui.banner("diagnostics"));

  const checks: Check[] = [];
  const config = loadConfig();

  // -- config ---------------------------------------------------------------

  ui.heading("configuration");
  if (!config) {
    checks.push({
      level: "bad",
      label: "node is not configured",
      fix: "xorv init",
    });
    render(checks);
    ui.blank();
    ui.info(`start here: ${ui.c.accent("xorv init")}`);
    return;
  }

  checks.push({ level: "ok", label: `config at ${configPath()}` });
  checks.push({
    level: config.capabilities.length > 0 ? "ok" : "bad",
    label: `${config.capabilities.length} capability(s) configured`,
    detail: config.capabilities
      .map((c) => `${c.displayName} @ ${formatUsd(c.priceUsdMicros)}`)
      .join(", "),
    fix: config.capabilities.length === 0 ? "xorv init" : undefined,
  });
  checks.push({
    level: safeMode() ? "warn" : "ok",
    label: safeMode()
      ? "XORV_SAFE_MODE is on — tools disabled, text generation only"
      : "running in full agent mode — prompts come from strangers",
    detail: safeMode() ? undefined : "see SECURITY.md",
  });

  // Name the containment tier rather than the word "sandboxed", so an operator
  // can tell the difference between a filesystem boundary and a tidy directory.
  const tier = detectSandbox();
  const withheld = withheldEnvKeys().length;
  checks.push({
    level: tier === "none" || tier === "env" ? "warn" : "ok",
    label: `sandbox: ${describeSandbox(tier)}`,
    detail:
      tier === "seatbelt" || tier === "bwrap"
        ? `payout key and credentials unreadable by a job; ${withheld} env var(s) withheld` +
          " — XORV_SANDBOX=container for full isolation"
        : tier === "container"
          ? `${withheld} env var(s) withheld from jobs`
          : "a hostile prompt could read files this user can read",
    fix: tier === "none" || tier === "env" ? "run on macOS/Linux, or XORV_SANDBOX=container" : undefined,
  });
  render(checks.splice(0));

  // -- payout ---------------------------------------------------------------

  ui.heading("payout account");
  const payoutChecks: Check[] = [];
  if (!config.accountId) {
    payoutChecks.push({ level: "bad", label: "no payout account set", fix: "xorv init" });
  } else {
    const spin = ui.spinner(`querying ${config.accountId}…`);
    try {
      const balances = await fetchBalances(config.network, config.accountId);
      spin.stop();
      const hbar = Number(balances.hbarTinybars) / 1e8;
      payoutChecks.push({
        level: "ok",
        label: `account ${config.accountId} exists on ${networkLabel(config.network)}`,
        detail: hashscanAccount(config.network, config.accountId),
      });
      payoutChecks.push({
        // A provider is *paid*, so it needs no HBAR to operate — the facilitator
        // covers gas. A zero balance is therefore fine, not an error.
        level: "ok",
        label: `balance ${hbar.toFixed(4)} ℏ · ${formatUsd(Number(balances.usdcUnits))} USDC`,
        detail: hbar === 0 ? "no HBAR needed — the facilitator pays gas for settlements" : undefined,
      });
      // `canReceiveUsdc`, not `usdcAssociated`: an account with automatic
      // association slots can be paid without ever opting in explicitly, and
      // telling that operator to run `wallet associate` sends them to spend
      // HBAR on a transaction they do not need.
      payoutChecks.push({
        level: balances.canReceiveUsdc ? "ok" : "bad",
        label: balances.canReceiveUsdc
          ? balances.usdcAssociated
            ? `associated with USDC (${usdcTokenId(config.network)})`
            : `can receive USDC via automatic association (${
                balances.maxAutoAssociations === -1
                  ? "unlimited slots"
                  : `${balances.maxAutoAssociations} slots`
              })`
          : "cannot receive USDC — no association and no automatic slots, so USDC payments will be rejected before they settle",
        fix: balances.canReceiveUsdc ? undefined : "xorv wallet associate",
      });
    } catch (err) {
      spin.stop();
      payoutChecks.push({
        level: "bad",
        label: `could not reach the mirror node for ${config.accountId}`,
        detail: err instanceof Error ? err.message : String(err),
        fix: "check the account id and your network connection",
      });
    }
  }
  render(payoutChecks);

  // -- broker ---------------------------------------------------------------

  ui.heading("broker");
  const brokerUrl = resolveBrokerUrl(config);
  const brokerChecks: Check[] = [];
  const spin = ui.spinner(`pinging ${brokerUrl}…`);
  try {
    const res = await fetch(`${brokerUrl}/api/network`, { signal: AbortSignal.timeout(8_000) });
    spin.stop();
    if (res.ok) {
      const info = (await res.json()) as {
        network: string;
        facilitator: { description: string; feePayer: string };
        stats: { providersLive: number };
      };
      brokerChecks.push({ level: "ok", label: `reachable at ${brokerUrl}` });
      brokerChecks.push({
        level: info.network === config.network ? "ok" : "bad",
        label: `broker is on ${info.network}, this node is on ${config.network}`,
        fix: info.network === config.network ? undefined : "make them match in ~/.xorv/config.json",
      });
      brokerChecks.push({
        level: "ok",
        label: `facilitator: ${info.facilitator.description}`,
        detail: `fee payer ${info.facilitator.feePayer}`,
      });
      brokerChecks.push({
        level: "ok",
        label: `${info.stats.providersLive} provider(s) live on the network`,
      });
    } else {
      brokerChecks.push({ level: "bad", label: `broker returned ${res.status}` });
    }
  } catch (err) {
    spin.stop();
    brokerChecks.push({
      level: "bad",
      label: `cannot reach the broker at ${brokerUrl}`,
      detail: err instanceof Error ? err.message : String(err),
      fix: "start it with `pnpm broker`, or point XORV_BROKER_URL somewhere else",
    });
  }
  render(brokerChecks);

  // -- adapters -------------------------------------------------------------

  ui.heading("agent CLIs");
  const detected = await detectAvailable();
  const configured = new Set(config.capabilities.map((c) => c.adapter));
  const adapterChecks: Check[] = detected.map(({ adapter, available }) => {
    const selling = configured.has(adapter.kind);
    if (available) {
      return {
        level: "ok" as Level,
        label: `${adapter.kind}${selling ? ui.c.muted(" (selling)") : ui.c.muted(" (available, not listed)")}`,
      };
    }
    return {
      level: selling ? ("bad" as Level) : ("warn" as Level),
      label: `${adapter.kind} not available${selling ? ui.c.bad(" — but this node is selling it") : ""}`,
      fix: selling ? adapter.installHint : undefined,
    };
  });
  render(adapterChecks);

  // -- optional -------------------------------------------------------------

  ui.heading("optional");
  const hasCloudflared = await cloudflaredAvailable();
  render([
    {
      level: hasCloudflared ? "ok" : "warn",
      label: hasCloudflared
        ? "cloudflared installed — `xorv start --tunnel` will give this node a public URL"
        : "cloudflared not installed — the node still works, just without a public URL",
      fix: hasCloudflared ? undefined : CLOUDFLARED_INSTALL_HINT,
    },
  ]);

  // -- verdict --------------------------------------------------------------

  ui.blank();
  const blockers = [...payoutChecks, ...brokerChecks, ...adapterChecks].filter(
    (c) => c.level === "bad",
  );
  if (blockers.length === 0) {
    console.log(
      ui.box([`${ui.glyph.ok()} ${ui.c.bold("this node is ready")}`, "", `  ${ui.c.accent("xorv start")} ${ui.c.muted("— go live")}`], {
        title: "healthy",
      }),
    );
  } else {
    console.log(
      ui.box(
        [
          `${ui.glyph.bad()} ${ui.c.bold(`${blockers.length} thing(s) will stop this node earning`)}`,
          "",
          ...blockers.map((b) => `  ${ui.c.bad("•")} ${ui.stripAnsi(b.label)}${b.fix ? ui.c.muted(`  → ${b.fix}`) : ""}`),
        ],
        { title: "needs attention", color: ui.BRAND.rose },
      ),
    );
  }
  ui.blank();
}

function render(checks: Check[]): void {
  for (const check of checks) {
    const mark =
      check.level === "ok" ? ui.glyph.ok() : check.level === "warn" ? ui.glyph.warn() : ui.glyph.bad();
    console.log(`${mark} ${check.label}`);
    if (check.detail) console.log(`  ${ui.c.muted(check.detail)}`);
    if (check.fix) console.log(`  ${ui.c.accent("→")} ${ui.c.muted(check.fix)}`);
  }
}
