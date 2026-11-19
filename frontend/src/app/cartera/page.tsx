"use client";


import { useApp } from "@/components/Providers";
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

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-10">
      <h1 className="text-3xl font-bold">{dict.navWallet}</h1>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-full border border-slate-700 px-4 py-2 text-sm"
          onClick={() => setSolAddress("seller-sol")}
        >
          {dict.connectSol}
        </button>
        <p className="text-sm text-slate-400" data-testid="sol-address">
          {solAddress ?? "—"}
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Saldos Solana</h2>
        <ul className="space-y-1 text-sm font-mono text-slate-300">
          {Object.entries(demo.solBalances).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Solicitudes</h2>
        {demo.requests.map((r) => {
          const snap = snapshotDeadlines(r.deadline, r.hardDeadline, now);
          const canRefund =
            snap.phase === "past_hard" && r.status === "Pending";
          return (
            <article
              key={r.transferId}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
              data-testid={`request-${r.transferId}`}
            >
              <p className="font-mono text-xs text-slate-500">{r.transferId}</p>
              <p>
                {r.status}
                {r.rejectReason ? ` — ${r.rejectReason}` : ""}
              </p>
              <p className="text-sm text-slate-400">
                Countdown: {formatCountdown(snap.secondsToDeadline)} / hard{" "}
                {formatCountdown(snap.secondsToHardDeadline)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full bg-cyan-300 px-3 py-1 text-sm font-semibold text-slate-950 disabled:opacity-40"
                  disabled={!canSignSol}
                  data-testid="btn-sell"
                >
                  Vender
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-600 px-3 py-1 text-sm disabled:opacity-40"
                  disabled={!canSignSol}
                  data-testid="btn-buy"
                >
                  Comprar
                </button>
                <button
                  type="button"
                  className="rounded-full border border-amber-700 px-3 py-1 text-sm text-amber-100 disabled:opacity-40"
                  disabled={!canSignSol || !canRefund}
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
                  Reembolsar
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
