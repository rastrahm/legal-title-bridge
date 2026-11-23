"use client";

import type { DecodedTxView } from "@/lib/tx/decode";

export interface ConfirmTxPanelProps {
  title: string;
  hint: string;
  decoded: DecodedTxView;
  simulationOk: boolean | null;
  simulationError?: string;
  disabled?: boolean;
  confirmLabel?: string;
  simOkLabel?: string;
  simFailLabel?: string;
  onConfirm: () => void;
}

/**
 * W4 confirmation surface built from decoded transaction + simulation result.
 */
export function ConfirmTxPanel({
  title,
  hint,
  decoded,
  simulationOk,
  simulationError,
  disabled,
  confirmLabel = "Firmar",
  simOkLabel = "Simulation OK",
  simFailLabel = "Simulation failed",
  onConfirm,
}: ConfirmTxPanelProps) {
  return (
    <section
      aria-label={title}
      className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
    >
      <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
      <p className="text-sm text-slate-400">{hint}</p>
      <dl className="grid gap-2 text-sm text-slate-200">
        <div>
          <dt className="text-slate-500">to</dt>
          <dd data-testid="confirm-to">{decoded.to}</dd>
        </div>
        <div>
          <dt className="text-slate-500">function</dt>
          <dd data-testid="confirm-fn">{decoded.functionName}</dd>
        </div>
        <div>
          <dt className="text-slate-500">value</dt>
          <dd data-testid="confirm-value">{decoded.value}</dd>
        </div>
        {Object.entries(decoded.args).map(([k, v]) => (
          <div key={k}>
            <dt className="text-slate-500">{k}</dt>
            <dd data-testid={`confirm-arg-${k}`}>{v}</dd>
          </div>
        ))}
      </dl>
      {simulationOk === false ? (
        <p role="alert" className="text-sm text-rose-300">
          {simulationError ?? simFailLabel}
        </p>
      ) : null}
      {simulationOk === true ? (
        <p className="text-sm text-emerald-300">{simOkLabel}</p>
      ) : null}
      <button
        type="button"
        data-testid="btn-confirm-sign"
        className="rounded-full bg-cyan-300 px-5 py-2 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={disabled || simulationOk === false}
        onClick={onConfirm}
      >
        {confirmLabel}
      </button>
    </section>
  );
}
