"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ContextualHelp } from "@/components/ContextualHelp";
import { useApp } from "@/components/Providers";
import { useConnectWallets } from "@/hooks/useConnectWallets";
import { resolveAddresses } from "@/lib/addresses";
import {
  readIsVerified,
  type VerificationStatus,
} from "@/lib/contracts/identity-read";
import { holderIdFromSolanaAddress } from "@/lib/holder";
import { t } from "@/lib/i18n";

/**
 * Buyer onboarding — Phantom → holder (D2) → verification status → next actions.
 * Does not grant AccessControl roles (buyers are clients, not admins).
 */
export default function CompradorPage() {
  const { locale, canSignSol, solAddress } = useApp();
  const { connectSol, error: connectError, busy } = useConnectWallets();
  const dict = t(locale);
  const addresses = resolveAddresses();

  const [status, setStatus] = useState<VerificationStatus>("unknown");
  const [statusBusy, setStatusBusy] = useState(false);
  const [entered, setEntered] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const walletReady = canSignSol && Boolean(solAddress);

  const holder = useMemo(() => {
    if (!solAddress) return null;
    try {
      return holderIdFromSolanaAddress(solAddress);
    } catch {
      return null;
    }
  }, [solAddress]);

  const refreshStatus = useCallback(async () => {
    if (!holder) {
      setStatus("unknown");
      return;
    }
    setStatusBusy(true);
    try {
      const next = await readIsVerified(addresses.identityRegistry, holder);
      setStatus(next);
    } finally {
      setStatusBusy(false);
    }
  }, [addresses.identityRegistry, holder]);

  // Auto-check only when holder exists; setState only in the promise callback.
  useEffect(() => {
    if (!holder) return;
    let cancelled = false;
    void readIsVerified(addresses.identityRegistry, holder).then(
      (next) => {
        if (!cancelled) setStatus(next);
      },
      () => {
        if (!cancelled) setStatus("unknown");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [addresses.identityRegistry, holder]);

  async function copyHolder() {
    if (!holder) return;
    try {
      await navigator.clipboard.writeText(holder);
      setCopyNotice(dict.buyerCopied);
    } catch {
      setCopyNotice(holder);
    }
  }

  const statusLabel =
    status === "verified"
      ? dict.buyerStatusVerified
      : status === "unverified"
        ? dict.buyerStatusUnverified
        : dict.buyerStatusUnknown;

  const verifierHref = holder
    ? `/verificador?holder=${encodeURIComponent(holder)}`
    : "/verificador";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-10">
      <h1 className="text-3xl font-bold">{dict.buyerTitle}</h1>
      <ContextualHelp screen="comprador" />
      <p className="max-w-2xl text-sm leading-6 text-slate-400">{dict.buyerLead}</p>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold">{dict.buyerStep1}</h2>
        <button
          type="button"
          className="rounded-full border border-slate-700 px-4 py-2 text-sm"
          data-testid="btn-connect-sol"
          disabled={busy}
          onClick={() => {
            void connectSol().catch(() => undefined);
          }}
        >
          {dict.connectSol}
        </button>
        <p className="font-mono text-sm text-slate-400" data-testid="sol-address">
          {solAddress ?? "—"}
        </p>
        {connectError ? (
          <p role="alert" className="text-sm text-rose-300">
            {connectError}
          </p>
        ) : null}
        {!walletReady ? (
          <p className="text-sm text-amber-200">{dict.buyerNeedWallet}</p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold">{dict.buyerStep2}</h2>
        <p className="text-sm text-slate-400">{dict.buyerHolderHint}</p>
        <p
          className="break-all font-mono text-xs text-cyan-200"
          data-testid="buyer-holder"
        >
          {holder ?? "—"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-600 px-3 py-1 text-sm disabled:opacity-40"
            disabled={!holder}
            data-testid="btn-copy-holder"
            onClick={() => void copyHolder()}
          >
            {dict.buyerCopyHolder}
          </button>
          <Link
            href={verifierHref}
            className="rounded-full border border-cyan-800 px-3 py-1 text-sm text-cyan-200"
            data-testid="link-buyer-verifier"
          >
            {dict.buyerOpenVerifier}
          </Link>
        </div>
        {copyNotice ? (
          <p role="status" className="text-sm text-emerald-300">
            {copyNotice}
          </p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold">{dict.buyerStep3}</h2>
        <p
          className={
            status === "verified"
              ? "text-emerald-300"
              : status === "unverified"
                ? "text-amber-200"
                : "text-slate-400"
          }
          data-testid="buyer-verify-status"
        >
          {statusLabel}
        </p>
        <button
          type="button"
          className="rounded-full border border-slate-600 px-3 py-1 text-sm disabled:opacity-40"
          disabled={!holder || statusBusy}
          data-testid="btn-refresh-verify"
          onClick={() => void refreshStatus()}
        >
          {dict.buyerRefreshStatus}
        </button>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold">{dict.buyerStep4}</h2>
        <button
          type="button"
          className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
          disabled={!walletReady || !holder}
          data-testid="btn-buyer-enter"
          onClick={() => setEntered(true)}
        >
          {dict.buyerConfirmEnter}
        </button>
        {entered ? (
          <p role="status" className="text-sm text-emerald-300" data-testid="buyer-entered">
            {dict.buyerEnterOk}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="text-cyan-300 hover:underline" href="/activos">
            {dict.buyerGoExplorer}
          </Link>
          <Link className="text-cyan-300 hover:underline" href="/cartera/comprar">
            {dict.buyerGoWallet}
          </Link>
        </div>
      </section>
    </main>
  );
}
