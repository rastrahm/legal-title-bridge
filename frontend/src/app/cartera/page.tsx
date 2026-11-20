"use client";

import { useState } from "react";

import { useApp } from "@/components/Providers";
import { DEMO_ASSET_ID } from "@/lib/demo/store";
import { formatCountdown, snapshotDeadlines } from "@/lib/deadlines";
import { t } from "@/lib/i18n";

/**
 * Holder / buyer wallet view — balances, requests, refund when due.
 */
export default function CarteraPage() {
  const { locale, demo, canSignSol, setDemo, solAddress, setSolAddress } =
    useApp();
  const dict = t(locale);
  const now = 1_700_000_000;
  const [notice, setNotice] = useState<string | null>(null);
  const walletReady = canSignSol && Boolean(solAddress);

  function createSale(price: string) {
    if (!walletReady) {
      setNotice(dict.connectWalletFirst);
      return;
    }
    const transferId = `0xsale:${Date.now().toString(16)}`;
    setDemo((prev) => ({
      ...prev,
      requests: [
        {
          transferId,
          assetId: DEMO_ASSET_ID,
          seller: solAddress ?? "seller-sol",
          buyer: "buyer-sol",
          amount: price,
          deadline: now + 3600,
          hardDeadline: now + 3600 + 7 * 86400,
          status: "Pending",
        },
        ...prev.requests,
      ],
      messages: [
        {
          messageId: `request:${transferId}`,
          status: "seen",
          direction: "sol_to_eth",
        },
        ...prev.messages,
      ],
    }));
    setNotice(dict.saleCreated);
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-10">
      <h1 className="text-3xl font-bold">{dict.navWallet}</h1>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-full border border-slate-700 px-4 py-2 text-sm"
          data-testid="btn-connect-sol"
          onClick={() => setSolAddress("seller-sol")}
        >
          {dict.connectSol}
        </button>
        <p className="text-sm text-slate-400" data-testid="sol-address">
          {solAddress ?? "—"}
        </p>
      </div>

      {notice ? (
        <p role="status" className="text-sm text-emerald-300" data-testid="wallet-notice">
          {notice}
        </p>
      ) : null}

      <p className="text-sm text-slate-400" data-testid="deadline-hint">
        {dict.deadlineHint}
      </p>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{dict.solBalances}</h2>
        <ul className="space-y-1 text-sm font-mono text-slate-300">
          {Object.entries(demo.solBalances).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{dict.requests}</h2>
        {demo.requests.map((r) => {
          const snap = snapshotDeadlines(r.deadline, r.hardDeadline, now);
          const canRefund =
            snap.phase === "past_hard" && r.status === "Pending";
          const rejectLabel =
            r.rejectReason === "CERTIFICATION_EXPIRED"
              ? dict.rejectCertExpired
              : r.rejectReason === "NOT_VERIFIED"
                ? dict.rejectNotVerified
                : r.rejectReason
                  ? `${r.status} — ${r.rejectReason}`
                  : null;
          return (
            <article
              key={r.transferId}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
              data-testid={`request-${r.transferId}`}
            >
              <p className="font-mono text-xs text-slate-500">{r.transferId}</p>
              <p data-testid={`request-status-${r.transferId}`}>
                {rejectLabel ?? r.status}
              </p>
              <p className="text-sm text-slate-400">
                Countdown: {formatCountdown(snap.secondsToDeadline)} / hard{" "}
                {formatCountdown(snap.secondsToHardDeadline)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full bg-cyan-300 px-3 py-1 text-sm font-semibold text-slate-950 disabled:opacity-40"
                  disabled={!walletReady}
                  data-testid="btn-sell"
                  onClick={() => createSale("7")}
                >
                  {dict.btnSell}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-600 px-3 py-1 text-sm disabled:opacity-40"
                  disabled={!walletReady}
                  data-testid="btn-buy"
                  onClick={() => {
                    if (!walletReady) {
                      setNotice(dict.connectWalletFirst);
                      return;
                    }
                    setDemo((prev) => ({
                      ...prev,
                      requests: prev.requests.map((x) =>
                        x.transferId === r.transferId
                          ? { ...x, buyer: solAddress ?? x.buyer }
                          : x,
                      ),
                    }));
                    setNotice(dict.buyStarted);
                  }}
                >
                  {dict.btnBuy}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-600 px-3 py-1 text-sm disabled:opacity-40"
                  disabled={!walletReady || r.status !== "Pending"}
                  data-testid="btn-cancel-sale"
                  onClick={() => {
                    setDemo((prev) => ({
                      ...prev,
                      requests: prev.requests.filter(
                        (x) => x.transferId !== r.transferId,
                      ),
                    }));
                    setNotice(dict.saleCancelled);
                  }}
                >
                  {dict.btnCancelSale}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-amber-700 px-3 py-1 text-sm text-amber-100 disabled:opacity-40"
                  disabled={!walletReady || !canRefund}
                  data-testid="btn-refund"
                  onClick={() =>
                    setDemo((prev) => ({
                      ...prev,
                      requests: prev.requests.map((x) =>
                        x.transferId === r.transferId
                          ? { ...x, status: "Refunded" }
                          : x,
                      ),
                    }))
                  }
                >
                  {dict.btnRefund}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <button
        type="button"
        className="rounded-full border border-slate-700 px-3 py-1 text-xs"
        data-testid="btn-retry-price"
        disabled={!walletReady}
        onClick={() => createSale("9")}
      >
        {dict.btnSell} · 9
      </button>
    </main>
  );
}
