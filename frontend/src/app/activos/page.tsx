"use client";


import Link from "next/link";

import { useApp } from "@/components/Providers";
import { t } from "@/lib/i18n";

/**
 * Explorer index — list demo assets.
 */
export default function ActivosIndexPage() {
  const { locale, demo } = useApp();
  const dict = t(locale);
  const assets = Object.values(demo.assets);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <h1 className="text-3xl font-bold">{dict.navExplorer}</h1>
      <ul className="mt-8 space-y-3">
        {assets.map((a) => (
          <li key={a.assetId}>
            <Link
              className="block rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 hover:border-cyan-700"
              href={`/activos/${a.assetId}`}
            >
              <span className="font-medium text-slate-50">{a.name}</span>
              <span className="mt-1 block font-mono text-xs text-slate-500">
                {a.assetId}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
