"use client";

import { useState, useSyncExternalStore } from "react";

import { CarteraShell } from "@/app/cartera/CarteraShell";
import { useApp } from "@/components/Providers";
import {
  decodeDvPHandoff,
  DVP_HANDOFF_SOFT_TTL_MS,
  type DvPHandoffPayload,
} from "@/lib/cartera/dvp-handoff";
import { buyerCompleteDvPHandoff } from "@/lib/cartera/purchase";
import { t } from "@/lib/i18n";

function subscribeHash(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function readHashPayload(): DvPHandoffPayload | null {
  if (typeof window === "undefined") return null;
  return decodeDvPHandoff(window.location.hash.replace(/^#/, ""));
}

/**
 * Buyer completes a seller-signed request_transfer (cross-device handoff).
 */
export default function CarteraFirmarPage() {
  const { locale, canSignSol, setDemo, solAddress } = useApp();
  const dict = t(locale);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const payload = useSyncExternalStore(
    subscribeHash,
    readHashPayload,
    () => null,
  );
  const walletReady = canSignSol && Boolean(solAddress);

  const ttlHint = payload
    ? Math.ceil(DVP_HANDOFF_SOFT_TTL_MS / 1000)
    : null;

  async function signAsBuyer() {
    if (!payload) {
      setNotice(dict.dvpFirmarMissing);
      return;
    }
    if (!walletReady || !solAddress) {
      setNotice(dict.connectWalletFirst);
      return;
    }
    if (solAddress !== payload.buyer) {
      setNotice(
        `${dict.dvpFirmarWrongBuyer} (${payload.buyer.slice(0, 8)}…)`,
      );
      return;
    }
    setBusy(true);
    try {
      const result = await buyerCompleteDvPHandoff(payload, (msg) =>
        setNotice(msg),
      );
      if (payload.offerTransferId) {
        setDemo((prev) => ({
          ...prev,
          requests: prev.requests.map((x) =>
            x.transferId === payload.offerTransferId
              ? { ...x, status: "DepositDemo" as const }
              : x,
          ),
          messages: [
            {
              messageId: `dvp:${result.signature}`,
              status: "seen" as const,
              direction: "sol_to_eth" as const,
            },
            ...prev.messages,
          ],
        }));
      }
      setNotice(`${dict.dvpFirmarOk}: ${result.signature.slice(0, 20)}…`);
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CarteraShell
      title={dict.dvpFirmarTitle}
      mode="comprar"
      notice={notice}
    >
      <p className="max-w-2xl text-sm text-slate-400">{dict.dvpFirmarLead}</p>

      {!payload ? (
        <p className="text-sm text-rose-300" data-testid="firmar-missing">
          {dict.dvpFirmarMissing}
        </p>
      ) : (
        <section
          className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5"
          data-testid="firmar-payload"
        >
          <dl className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{dict.requestBuyer}</dt>
              <dd className="font-mono text-xs break-all">{payload.buyer}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{dict.requestSeller}</dt>
              <dd className="font-mono text-xs break-all">{payload.seller}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Escrow</dt>
              <dd className="font-mono text-xs break-all">{payload.escrow}</dd>
            </div>
            <div>
              <dt className="text-slate-500">TTL</dt>
              <dd>~{ttlHint ?? "?"}s</dd>
            </div>
          </dl>
          <button
            type="button"
            className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
            data-testid="btn-firmar-dvp"
            disabled={!walletReady || busy}
            onClick={() => {
              void signAsBuyer();
            }}
          >
            {busy ? "…" : dict.dvpFirmarBtn}
          </button>
        </section>
      )}
    </CarteraShell>
  );
}
