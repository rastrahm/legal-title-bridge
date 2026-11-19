"use client";

import { useEffect, useState } from "react";

import { useApp } from "@/components/Providers";
import { checkI2 } from "@/lib/bridge-status";
import { fetchRelayerStatus, type RelayerStatus } from "@/lib/relayer-client";
import { t } from "@/lib/i18n";

export interface PuenteClientProps {
  e2eFakeRelayer?: boolean;
}

/**
 * Bridge monitor client — optional fake relayer payload via prop (W6).
 */
export function PuenteClient({ e2eFakeRelayer = false }: PuenteClientProps) {
  const { locale, demo } = useApp();
  const dict = t(locale);
  const i2 = checkI2({
    ethCirculating: BigInt(demo.ethCirculating),
    solIssued: BigInt(demo.solIssued),
  });

  const [relayer, setRelayer] = useState<RelayerStatus | null>(() =>
    e2eFakeRelayer
      ? {
          i2Ok: false,
          ethCirculating: "999",
          solIssued: "1",
          messageCount: 99,
        }
      : null,
  );
  const [relayerError, setRelayerError] = useState<string | null>(null);

  useEffect(() => {
    if (e2eFakeRelayer) return;
    const base = process.env.NEXT_PUBLIC_RELAYER_URL;
    if (!base) return;
    void fetchRelayerStatus({ baseUrl: base })
      .then(setRelayer)
      .catch((e: unknown) =>
        setRelayerError(e instanceof Error ? e.message : String(e)),
      );
  }, [e2eFakeRelayer]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-10">
      <h1 className="text-3xl font-bold">{dict.navBridge}</h1>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          {dict.chainTruth}
        </h2>
        <p
          className={`mt-2 text-lg ${i2 ? "text-emerald-300" : "text-rose-300"}`}
          data-testid="chain-i2"
        >
          Eth {demo.ethCirculating} / Sol {demo.solIssued} —{" "}
          {i2 ? dict.i2Ok : dict.i2Bad}
        </p>
      </section>

      <section className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-200/80">
          {dict.relayerInformed}
        </h2>
        {relayer ? (
          <p data-testid="relayer-status" className="mt-2 text-sm text-slate-300">
            Relayer dice I2={String(relayer.i2Ok)} eth={relayer.ethCirculating}{" "}
            sol={relayer.solIssued} msgs={relayer.messageCount}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500" data-testid="relayer-status">
            {relayerError ?? "Sin datos del relayer"}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Mensajes</h2>
        <ul className="space-y-2 text-sm">
          {demo.messages.map((m) => (
            <li
              key={m.messageId}
              className="rounded border border-slate-800 px-3 py-2 font-mono text-xs"
              data-testid={`msg-${m.status}`}
            >
              [{m.status}] {m.messageId}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
