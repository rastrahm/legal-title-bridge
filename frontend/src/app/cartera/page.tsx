"use client";

import Link from "next/link";

import { CarteraShell } from "@/app/cartera/CarteraShell";
import { useApp } from "@/components/Providers";
import { t } from "@/lib/i18n";

/**
 * Cartera hub — choose Sell or Buy workspace (no protocol form dump).
 */
export default function CarteraHubPage() {
  const { locale } = useApp();
  const dict = t(locale);

  return (
    <CarteraShell title={dict.navWallet} mode="hub" notice={null}>
      <p className="max-w-2xl text-sm text-slate-400">{dict.carteraHubLead}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/cartera/vender"
          data-testid="card-cartera-vender"
          className="block rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-cyan-700"
        >
          <h2 className="text-xl font-semibold text-slate-50">
            {dict.carteraSellTitle}
          </h2>
          <p className="mt-2 text-sm text-slate-400">{dict.carteraSellLead}</p>
        </Link>
        <Link
          href="/cartera/comprar"
          data-testid="card-cartera-comprar"
          className="block rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-cyan-700"
        >
          <h2 className="text-xl font-semibold text-slate-50">
            {dict.carteraBuyTitle}
          </h2>
          <p className="mt-2 text-sm text-slate-400">{dict.carteraBuyLead}</p>
        </Link>
      </div>
    </CarteraShell>
  );
}
