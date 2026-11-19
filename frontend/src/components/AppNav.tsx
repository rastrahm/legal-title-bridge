"use client";

import Link from "next/link";

import type { Dictionary, Locale } from "@/lib/i18n";

export interface AppNavProps {
  dict: Dictionary;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

/**
 * Primary navigation for all FRONT views.
 */
export function AppNav({ dict, locale, onLocaleChange }: AppNavProps) {
  const links = [
    { href: "/", label: dict.navHome },
    { href: "/activos", label: dict.navExplorer },
    { href: "/cartera", label: dict.navWallet },
    { href: "/operador", label: dict.navOperator },
    { href: "/verificador", label: dict.navVerifier },
    { href: "/puente", label: dict.navBridge },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300"
        >
          {dict.brand}
        </Link>
        <nav aria-label="Primary" className="flex flex-wrap gap-3 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-slate-300 transition hover:text-cyan-200"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex gap-2" role="group" aria-label="Locale">
          <button
            type="button"
            className={`rounded px-2 py-1 text-xs ${locale === "es" ? "bg-cyan-300 text-slate-950" : "text-slate-400"}`}
            onClick={() => onLocaleChange("es")}
          >
            ES
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 text-xs ${locale === "en" ? "bg-cyan-300 text-slate-950" : "text-slate-400"}`}
            onClick={() => onLocaleChange("en")}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}
