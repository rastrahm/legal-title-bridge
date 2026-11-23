"use client";

import { useEffect, useMemo, useState } from "react";

import { ContextualHelp } from "@/components/ContextualHelp";
import { LedgerChainView } from "@/components/LedgerChainView";
import { useApp } from "@/components/Providers";
import { resolveAddresses } from "@/lib/addresses";
import {
  readOnChainAssetDetail,
  type OnChainAssetDetail,
} from "@/lib/contracts/registry-read";
import { sanitizeHttpsUrl } from "@/lib/links";
import { t } from "@/lib/i18n";
import type { AssetId } from "@/lib/asset-id";
import type { LedgerEntry } from "@/lib/ledger";
import { isE2eLab } from "@/lib/wallets/env";

export interface AssetDetailClientProps {
  assetId: AssetId;
  e2eXss?: boolean;
  e2eBreakLedger?: boolean;
  endpointParam?: string;
  programParam?: string;
}

/**
 * Client detail body — lab flags arrive as props from the server page (C16).
 * Merges demo store with on-chain TitleRegistry / AttestationRegistry reads.
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
  const idKey = assetId.toLowerCase();

  const configured = resolveAddresses(undefined, {
    endpoint: endpointParam,
    program: programParam,
  });

  const demoAsset =
    demo.assets[assetId] ?? demo.assets[idKey] ?? undefined;

  const [chain, setChain] = useState<OnChainAssetDetail | null>(null);
  const [chainErr, setChainErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isE2eLab());

  useEffect(() => {
    if (isE2eLab()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const detail = await readOnChainAssetDetail(
          configured.titleRegistry,
          configured.attestationRegistry,
          assetId,
        );
        if (!cancelled) {
          setChain(detail);
          setChainErr(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setChain(null);
          setChainErr(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetId, configured.titleRegistry, configured.attestationRegistry]);

  const displayName = e2eXss
    ? '<img src=x onerror="window.__xss=1">'
    : (demoAsset?.name ??
      (chain ? `Lote ${idKey.slice(0, 10)}…` : ""));

  const entries: LedgerEntry[] = useMemo(() => {
    const base = chain?.entries?.length
      ? chain.entries
      : (demoAsset?.entries ?? []);
    if (!e2eBreakLedger) return base;
    return base.map((e, i) =>
      i === 1 ? { ...e, entryHash: `0xdead${e.entryHash.slice(6)}` } : e,
    );
  }, [demoAsset, chain, e2eBreakLedger]);

  const holders = chain?.holders?.length
    ? chain.holders
    : (demoAsset?.holders ?? []);

  const certifications = demoAsset?.certifications ??
    (chain
      ? [
          {
            kind: "existence+registral",
            expiresAt: 0,
            active: chain.certified,
          },
        ]
      : []);

  const description =
    demoAsset?.description ??
    (chain
      ? `Estado ${chain.state} · circulating ${chain.circulating} · issued ${chain.totalIssued}`
      : "");

  const safeDescLink = useMemo(
    () => (demoAsset ? sanitizeHttpsUrl(demoAsset.description) : null),
    [demoAsset],
  );

  if (!demoAsset && !chain && !loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">{dict.assetNotFound}</h1>
        {chainErr ? (
          <p className="mt-2 text-sm text-amber-300">{chainErr}</p>
        ) : null}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold" data-testid="asset-name">
          {loading && !demoAsset ? "Cargando…" : displayName}
        </h1>
        <p className="font-mono text-xs text-slate-500">{assetId}</p>
        <p data-testid="asset-description">{description}</p>
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
        {chain ? (
          <p className="text-xs text-emerald-300" data-testid="asset-onchain-state">
            On-chain: {chain.state}
            {chain.certified ? " · certificado" : " · sin quórum de certificación"}
            {" · "}circulating {chain.circulating}
          </p>
        ) : null}
        {chainErr ? (
          <p className="text-xs text-amber-300">RPC: {chainErr}</p>
        ) : null}
      </header>
      <ContextualHelp screen="activoDetalle" />

      <p className="text-xs text-slate-500" data-testid="configured-endpoint">
        BridgeEndpoint: {configured.bridgeEndpoint}
      </p>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Titulares</h2>
        <ul className="space-y-2 text-sm">
          {holders.length === 0 ? (
            <li className="text-slate-500">Sin titulares en la ventana de logs.</li>
          ) : (
            holders.map((h) => (
              <li key={h.address} className="font-mono text-slate-300">
                {h.address}: {h.amount}
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Certificaciones</h2>
        <ul className="space-y-2 text-sm">
          {certifications.map((c) => (
            <li key={c.kind}>
              {c.kind} — {c.active ? "vigente" : "vencida / sin quórum"}
            </li>
          ))}
        </ul>
      </section>

      <LedgerChainView
        entries={entries}
        okLabel={
          chain ? (chain.ledgerOk ? dict.ledgerOk : dict.ledgerBroken) : dict.ledgerOk
        }
        brokenLabel={dict.ledgerBroken}
      />
    </main>
  );
}
