/**
 * World AgentKit proofs, from the node's side.
 *
 * The broker hands out a SIWE-style challenge; the node signs it with the same
 * key its earnings are paid to, and sends the result in the `agentkit` header.
 * If that address is registered in AgentBook (World Chain) to a real human, the
 * broker labels the node — or, on a quote, the buyer — `humanBacked`.
 *
 * Deliberately never fatal. A broker without AgentKit support, an unreachable
 * challenge endpoint or an unregistered address all mean the same thing: carry
 * on without the label. Proving humanity is an upgrade, not a precondition for
 * earning or buying.
 *
 * Register an address once, with World App, using
 * `npx @worldcoin/agentkit-cli register <address>`.
 */

import { createAgentkitClient, type AgentkitExtension } from "@worldcoin/agentkit";
import { accountFor } from "@kazuo/protocol";

/** AgentBook is on World Chain; the signature names it as the chain. */
export const AGENTKIT_CHAIN = "eip155:480";

/**
 * A signed `agentkit` header for `target`, or null when none could be made.
 *
 * `KAZUO_AGENTKIT=0` opts out entirely.
 */
export async function agentkitProof(
  brokerUrl: string,
  target: "register" | "quote",
  privateKey: string,
  /**
   * Told why no proof was made. Never fatal, but never silent either: a node
   * that quietly registered without its proof once lost its human-backed label
   * after a broker restart, and nothing anywhere said why.
   */
  onSkip?: (reason: string) => void,
): Promise<string | null> {
  if (process.env.KAZUO_AGENTKIT === "0") return null;
  try {
    const res = await fetch(`${brokerUrl}/api/agentkit/challenge?for=${target}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      onSkip?.(`challenge request answered ${res.status}`);
      return null;
    }
    const { agentkit } = (await res.json()) as { agentkit?: AgentkitExtension };
    if (!agentkit) {
      onSkip?.("broker offers no AgentKit challenge");
      return null;
    }

    const account = accountFor(privateKey);
    const client = createAgentkitClient({
      signer: {
        address: account.address,
        chainId: AGENTKIT_CHAIN,
        type: "eip191",
        signMessage: (message) => account.signMessage({ message }),
      },
    });
    return await client.createHeader(agentkit);
  } catch (err) {
    onSkip?.(err instanceof Error ? err.message : String(err));
    return null;
  }
}
