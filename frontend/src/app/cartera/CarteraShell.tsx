"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { ContextualHelp } from "@/components/ContextualHelp";
import { useApp } from "@/components/Providers";
import { useConnectWallets } from "@/hooks/useConnectWallets";
import { t } from "@/lib/i18n";

export interface CarteraShellProps {
  title: string;
  mode: "hub" | "vender" | "comprar";
  notice: string | null;
  children: ReactNode;
}

/**
 * Shared Phantom connect + mode switch for Cartera hub / sell / buy.
 */
export function CarteraShell({
  title,
  mode,
  notice,
  children,
}: CarteraShellProps) {
  const { locale, solAddress, canSignSol } = useApp();
  const { connectSol, error: connectError, busy } = useConnectWallets();
  const dict = t(locale);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-10">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          <Link href="/cartera" className="hover:text-cyan-300">
            {dict.navWallet}
          </Link>
          {mode !== "hub" ? (
            <>
              {" / "}
              <span className="text-slate-300">
                {mode === "vender" ? dict.carteraSellTitle : dict.carteraBuyTitle}
              </span>
            </>
          ) : null}
        </p>
        <h1 className="text-3xl font-bold" data-testid="cartera-heading">
          {title}
        </h1>
        <ContextualHelp screen="cartera" />
      </header>

      <nav
        className="flex flex-wrap gap-2"
        aria-label={dict.carteraModeNav}
        data-testid="cartera-mode-nav"
      >
        <Link
          href="/cartera/vender"
          data-testid="link-cartera-vender"
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            mode === "vender"
              ? "bg-cyan-300 text-slate-950"
              : "border border-slate-700 text-slate-200 hover:border-cyan-700"
          }`}
        >
          {dict.carteraSellTitle}
        </Link>
        <Link
          href="/cartera/comprar"
          data-testid="link-cartera-comprar"
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            mode === "comprar"
              ? "bg-cyan-300 text-slate-950"
              : "border border-slate-700 text-slate-200 hover:border-cyan-700"
          }`}
        >
          {dict.carteraBuyTitle}
        </Link>
      </nav>

      <div className="flex flex-wrap items-center gap-3">
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
        {canSignSol && solAddress ? (
          <span className="rounded-full border border-emerald-800/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-200">
            {dict.carteraConnected}
          </span>
        ) : null}
      </div>
      {connectError ? (
        <p
          role="alert"
          className="text-sm text-rose-300"
          data-testid="connect-sol-error"
        >
          {connectError}
        </p>
      ) : null}

      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200"
          data-testid="wallet-notice"
        >
          {notice}
        </p>
      ) : null}

      {children}
    </main>
  );
}
