import { Suspense } from "react";

import { AssetDetailClient } from "./AssetDetailClient";
import { parseAssetId } from "@/lib/asset-id";

/**
 * Public asset explorer — server page passes params + lab flags into client tree.
 */
export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ assetId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { assetId: raw } = await params;
  const sp = await searchParams;
  const assetId = parseAssetId(raw);

  if (!assetId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">assetId inválido</h1>
        <p className="mt-2 text-slate-400">Debe ser bytes32 hex (0x + 64).</p>
      </main>
    );
  }

  const flag = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] === "1" : v === "1";
  };

  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-6 py-16 text-center">
          <p>Cargando activo…</p>
        </main>
      }
    >
      <AssetDetailClient
        assetId={assetId}
        e2eXss={flag("e2eXss")}
        e2eBreakLedger={flag("e2eBreakLedger")}
        endpointParam={
          typeof sp.endpoint === "string" ? sp.endpoint : undefined
        }
        programParam={typeof sp.program === "string" ? sp.program : undefined}
      />
    </Suspense>
  );
}
