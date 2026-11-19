"use client";

import { useMemo } from "react";

import { LedgerChainView } from "@/components/LedgerChainView";
import { useApp } from "@/components/Providers";
import { resolveAddresses } from "@/lib/addresses";
import { sanitizeHttpsUrl } from "@/lib/links";
import { t } from "@/lib/i18n";
import type { AssetId } from "@/lib/asset-id";
import type { LedgerEntry } from "@/lib/ledger";

export interface AssetDetailClientProps {
  assetId: AssetId;
  e2eXss?: boolean;
  e2eBreakLedger?: boolean;
  endpointParam?: string;
  programParam?: string;
}

/**
 * Client detail body — lab flags arrive as props from the server page (C16).
 */
export function AssetDetailClient({
  assetId,
  e2eXss = false,
  e2eBreakLedger = false,
  endpointParam,
  programParam,
}: AssetDetailClientProps) {
  const { locale, demo } = useApp();
  const dict = t(locale);

  const configured = resolveAddresses(undefined, {
    endpoint: endpointParam,
    program: programParam,
  });

  const asset = demo.assets[assetId];

  const displayName = e2eXss
    ? '<img src=x onerror="window.__xss=1">'
    : (asset?.name ?? "");

  const entries: LedgerEntry[] = useMemo(() => {
    if (!asset) return [];
    if (!e2eBreakLedger) return asset.entries;
    return asset.entries.map((e, i) =>
      i === 1 ? { ...e, entryHash: `0xdead${e.entryHash.slice(6)}` } : e,
    );
  }, [asset, e2eBreakLedger]);

  const safeDescLink = useMemo(
    () => (asset ? sanitizeHttpsUrl(asset.description) : null),
    [asset],
  );

  if (!asset) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">Activo no encontrado</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold" data-testid="asset-name">
          {displayName}
        </h1>
        <p className="font-mono text-xs text-slate-500">{asset.assetId}</p>
        <p data-testid="asset-description">{asset.description}</p>
        {safeDescLink ? (
          <a
            className="text-sm text-cyan-300 underline"
            href={safeDescLink}
            rel="noreferrer"
            target="_blank"
          >
            {safeDescLink}
          </a>
        ) : null}
      </header>

      <p className="text-xs text-slate-500" data-testid="configured-endpoint">
        BridgeEndpoint: {configured.bridgeEndpoint}
      </p>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Titulares</h2>
        <ul className="space-y-2 text-sm">
          {asset.holders.map((h) => (
            <li key={h.address} className="font-mono text-slate-300">
              {h.address}: {h.amount}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Certificaciones</h2>
        <ul className="space-y-2 text-sm">
          {asset.certifications.map((c) => (
            <li key={c.kind}>
              {c.kind} — {c.active ? "vigente" : "vencida"}
            </li>
          ))}
        </ul>
      </section>

      <LedgerChainView
        entries={entries}
        okLabel={dict.ledgerOk}
        brokenLabel={dict.ledgerBroken}
      />
    </main>
  );
}
