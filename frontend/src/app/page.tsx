"use client";


import Link from "next/link";

import { ContextualHelp } from "@/components/ContextualHelp";
import { useApp } from "@/components/Providers";
import { getActiveNetwork } from "@/lib/config/network";
import { t } from "@/lib/i18n";
import { checkI2 } from "@/lib/bridge-status";

/**
 * Home: product pitch, active network, bridge I2 snapshot.
 */
export default function Home() {
  const { locale, demo } = useApp();
  const dict = t(locale);
  const network = getActiveNetwork();
  const i2 = checkI2({
    ethCirculating: BigInt(demo.ethCirculating),
    solIssued: BigInt(demo.solIssued),
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-12">
      <section className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          {dict.brand}
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          {dict.brand}
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-slate-300">{dict.homeLead}</p>
        <ContextualHelp screen="home" />
      </section>

      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <dt className="text-sm text-slate-400">Red</dt>
          <dd className="mt-1 font-medium">
            {locale === "es" ? network.labelEs : network.labelEn}
          </dd>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <dt className="text-sm text-slate-400">I2</dt>
          <dd
            className={`mt-1 font-medium ${i2 ? "text-emerald-300" : "text-rose-300"}`}
            data-testid="home-i2"
          >
            {i2 ? dict.i2Ok : dict.i2Bad}
          </dd>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <dt className="text-sm text-slate-400">Vistas</dt>
          <dd className="mt-2 flex flex-wrap gap-2 text-sm">
            <Link className="text-cyan-300 hover:underline" href="/comprador">
              {dict.navBuyer}
            </Link>
            <Link className="text-cyan-300 hover:underline" href="/activos">
              {dict.navExplorer}
            </Link>
            <Link className="text-cyan-300 hover:underline" href="/cartera">
              {dict.navWallet}
            </Link>
            <Link className="text-cyan-300 hover:underline" href="/puente">
              {dict.navBridge}
            </Link>
          </dd>
        </div>
      </dl>
    </main>
  );
}
