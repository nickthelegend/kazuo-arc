"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IDKitRequestWidget,
  selfieCheckLegacy,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";
import { BROKER_URL } from "@/lib/api";

/**
 * "Verify you're human" — World ID Selfie Check for the wallet that pays.
 *
 * The broker mints the request (the RP signing key never reaches the browser),
 * World's widget shows the QR, the person scans it with World App and shows
 * their face, and the proof goes back to the broker. The broker checks the
 * nonce, freshness and that the proof is bound to *this* address before World
 * sees it, and only then does the widget report success.
 *
 * What it buys: jobs paid from this address are recorded as bought by a human.
 * It never gates payment and never changes a price.
 */

interface Ticket {
  app_id: `app_${string}`;
  action: string;
  signal: string;
  allow_legacy_proofs: boolean;
  rp_context: RpContext;
  error?: string;
}

type State = "loading" | "unavailable" | "unverified" | "verified";

export function WorldVerify({ address }: { address: string }) {
  const [state, setState] = useState<State>("loading");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `${BROKER_URL}/api/worldid/status?purpose=buyer&subject=${encodeURIComponent(address)}`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as { enabled?: boolean; verified?: boolean };
      if (!res.ok || !body.enabled) setState("unavailable");
      else setState(body.verified ? "verified" : "unverified");
    } catch {
      setState("unavailable");
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function start(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${BROKER_URL}/api/worldid/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "buyer", subject: address }),
      });
      const body = (await res.json()) as Ticket;
      if (!res.ok) throw new Error(body.error ?? `Broker returned ${res.status}.`);
      setTicket(body);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // A broker without World ID configured has nothing to offer here.
  if (state === "unavailable") return null;

  if (state === "verified") {
    return (
      <p className="mt-3 rounded-lg border border-[var(--line)] px-3 py-2 text-[12px] leading-relaxed text-fg-2">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--live)] align-middle" aria-hidden />
        Human verified with World ID. Jobs you pay for are recorded as bought by a person.
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-[var(--line)] pt-3">
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy || state === "loading"}
        className="w-full rounded-lg border border-[var(--line-2)] px-3 py-2 text-[12px] text-fg transition-colors hover:bg-white/[0.04] disabled:opacity-40"
      >
        {busy ? "Preparing World ID…" : "Verify you're human — World ID"}
      </button>
      <p className="mt-1.5 text-[11px] leading-relaxed text-fg-4">
        Selfie Check in World App. No Orb needed; nothing personal is shared with Kazuo.
      </p>
      {error ? <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#f87171]">{error}</p> : null}

      {ticket ? (
        <IDKitRequestWidget
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setTicket(null);
          }}
          app_id={ticket.app_id}
          action={ticket.action}
          rp_context={ticket.rp_context}
          allow_legacy_proofs={ticket.allow_legacy_proofs}
          preset={selfieCheckLegacy({ signal: ticket.signal })}
          handleVerify={async (result: IDKitResult) => {
            const res = await fetch(`${BROKER_URL}/api/worldid/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(result),
            });
            const body = (await res.json()) as { verified?: boolean; error?: string };
            if (!res.ok || !body.verified) throw new Error(body.error ?? "Verification failed.");
          }}
          onSuccess={() => {
            setState("verified");
            setTicket(null);
          }}
          onError={(code) => setError(`World ID did not complete: ${code}`)}
        />
      ) : null}
    </div>
  );
}
