/**
 * Handing a job exactly one credential, instead of the keyring.
 *
 * This exists because of a conflict discovered by attacking the sandbox rather
 * than by reasoning about it. Claude Code authenticates by reading the macOS
 * Keychain, so the obvious profile — let the agent reach its own credentials —
 * leaves the Keychain readable. And a readable Keychain is not one secret, it
 * is all of them: a job under that profile can run
 *
 *     security find-internet-password -w
 *
 * and walk off with the provider's GitHub token. Closing the payout-key hole
 * while opening that one would be a bad trade made confidently.
 *
 * So the node does the reading. It recovers the agent's own token once, at
 * startup, outside any sandbox, and passes just that token into each job's
 * environment. The job runs with the Keychain denied outright: the agent still
 * authenticates, and `security` returns nothing to anyone who asks it for
 * something else.
 *
 * The token still belongs to the provider, and a job can still read it out of
 * its own environment — this bounds the damage to the agent session that was
 * already being rented out, rather than eliminating it. Everything else in the
 * keyring stops being reachable, which is the part that was never on offer.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AdapterKind } from "@xorv/protocol";

/** Read once per process: this shells out, and jobs are frequent. */
const cache = new Map<AdapterKind, Record<string, string>>();

interface KeychainCredentials {
  claudeAiOauth?: { accessToken?: string; expiresAt?: number };
}

/**
 * Pull Claude Code's OAuth token out of the login keychain.
 *
 * Returns null on anything unexpected — a provider authenticated a different
 * way, or on a platform without `security`. A null here means the job runs
 * without an injected token, which fails loudly at the agent rather than
 * silently producing an unauthenticated result.
 */
function claudeTokenFromKeychain(): string | null {
  if (process.platform !== "darwin") return null;
  try {
    const raw = execFileSync(
      "/usr/bin/security",
      ["find-generic-password", "-s", "Claude Code-credentials", "-a", os.userInfo().username, "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10_000 },
    ).trim();
    const parsed = JSON.parse(raw) as KeychainCredentials;
    const token = parsed.claudeAiOauth?.accessToken;
    return typeof token === "string" && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

/** The same token, for installations that keep it in a file instead. */
function claudeTokenFromFile(): string | null {
  const candidate = path.join(os.homedir(), ".claude", ".credentials.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(candidate, "utf8")) as KeychainCredentials;
    const token = parsed.claudeAiOauth?.accessToken;
    return typeof token === "string" && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

/**
 * Environment an adapter needs in order to authenticate inside the sandbox.
 *
 * Empty is a valid answer: an adapter that authenticates from a file the
 * sandbox already permits needs nothing injected.
 */
export function agentCredentials(kind: AdapterKind): Record<string, string> {
  const hit = cache.get(kind);
  if (hit) return hit;

  let creds: Record<string, string> = {};
  if (kind === "claude-code") {
    // An explicitly-set token wins: an operator who exported one has chosen a
    // specific identity to rent out, and it is not ours to override.
    const token =
      process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim() || claudeTokenFromKeychain() || claudeTokenFromFile();
    if (token) creds = { CLAUDE_CODE_OAUTH_TOKEN: token };
  }

  cache.set(kind, creds);
  return creds;
}

/** Whether a job for this adapter will be able to authenticate. */
export function canAuthenticate(kind: AdapterKind): boolean {
  if (kind !== "claude-code" || process.platform !== "darwin") return true;
  return Object.keys(agentCredentials(kind)).length > 0;
}

/** For tests, and for `xorv doctor` re-checking after a login. */
export function resetCredentialCache(): void {
  cache.clear();
}
