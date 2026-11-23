"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { ContextualHelp } from "@/components/ContextualHelp";
import { useApp } from "@/components/Providers";
import { resolveAddresses } from "@/lib/addresses";
import { listCreatedAssetIds } from "@/lib/contracts/registry-read";
import { isE2eLab } from "@/lib/wallets/env";
import { t } from "@/lib/i18n";

interface ListedAsset {
  assetId: string;
  name: string;
  source: "demo" | "onchain";
}

/**
 * Explorer index — demo assets + on-chain AssetCreated (recent window).
 */
export default function ActivosIndexPage() {
  const { locale, demo } = useApp();
  const dict = t(locale);
  const addresses = resolveAddresses();
  const [onChainIds, setOnChainIds] = useState<string[]>([]);
  const [rpcErr, setRpcErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isE2eLab());

  useEffect(() => {
    if (isE2eLab()) return;
    let cancelled = false;
    void (async () => {
      try {
        const ids = await listCreatedAssetIds(addresses.titleRegistry);
        if (!cancelled) {
          setOnChainIds(ids);
          setRpcErr(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setRpcErr(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addresses.titleRegistry]);

  const byId = new Map<string, ListedAsset>();
  for (const a of Object.values(demo.assets)) {
    const id = a.assetId.toLowerCase();
    byId.set(id, { assetId: id, name: a.name, source: "demo" });
  }
  for (const id of onChainIds) {
    const key = id.toLowerCase();
    if (!byId.has(key)) {
      byId.set(key, {
        assetId: key,
        name: `Lote ${key.slice(0, 10)}…`,
        source: "onchain",
      });
    }
  }
  const assets = [...byId.values()];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <h1 className="text-3xl font-bold">{dict.navExplorer}</h1>
      <div className="mt-4">
        <ContextualHelp screen="activos" />
      </div>
      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Cargando activos on-chain…</p>
      ) : null}
      {rpcErr ? (
        <p className="mt-4 text-sm text-amber-300" role="status">
          RPC explorador: {rpcErr}. Se muestran al menos los demo locales.
        </p>
      ) : null}
      <ul className="mt-8 space-y-3" data-testid="activos-list">
        {assets.map((a) => (
          <li key={a.assetId}>
            <Link
              className="block rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 hover:border-cyan-700"
              href={`/activos/${a.assetId}`}
            >
              <span className="font-medium text-slate-50">{a.name}</span>
              <span className="ml-2 text-xs text-slate-500">
                {a.source === "onchain" ? "on-chain" : "demo"}
              </span>
              <span className="mt-1 block font-mono text-xs text-slate-500">
                {a.assetId}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {assets.length === 0 && !loading ? (
        <p className="mt-8 text-sm text-slate-400">No hay activos listados.</p>
      ) : null}
    </main>
  );
}
