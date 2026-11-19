"use client";

import { verifyLedgerChain, type LedgerEntry } from "@/lib/ledger";

export interface LedgerChainViewProps {
  entries: LedgerEntry[];
  okLabel: string;
  brokenLabel: string;
}

/**
 * Recalculates ledger hashes in the browser and reports integrity.
 */
export function LedgerChainView({
  entries,
  okLabel,
  brokenLabel,
}: LedgerChainViewProps) {
  const result = verifyLedgerChain(entries);

  return (
    <section aria-label="Ledger" className="space-y-3">
      {result.ok ? (
        <p className="text-emerald-300" data-testid="ledger-status">
          {okLabel}
        </p>
      ) : (
        <p className="text-rose-300" data-testid="ledger-status">
          {brokenLabel} #{result.breakAt}
        </p>
      )}
      <ol className="space-y-2 text-xs text-slate-400">
        {entries.map((e, i) => (
          <li key={`${e.entryHash}-${i}`} data-testid={`ledger-entry-${i}`}>
            <span className="font-mono text-slate-300">{e.entryHash.slice(0, 18)}…</span>
            <span className="ml-2">{e.data}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
