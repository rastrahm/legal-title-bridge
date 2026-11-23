"use client";

import { useSyncExternalStore } from "react";

import { useApp } from "@/components/Providers";
import {
  getScreenHelp,
  type HelpScreenId,
} from "@/lib/help/content";
import { t } from "@/lib/i18n";

export interface ContextualHelpProps {
  screen: HelpScreenId;
}

/**
 * Per-screen help panel — what each control/section does (lab user-facing).
 * Body waits for client hydration so Turbopack HMR cannot mismatch SSR copy.
 */
export function ContextualHelp({ screen }: ContextualHelpProps) {
  const { locale } = useApp();
  const dict = t(locale);
  const help = getScreenHelp(screen, locale);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <details
      className="group rounded-xl border border-slate-800 bg-slate-950/60 open:border-cyan-900/60"
      data-testid={`help-${screen}`}
    >
      <summary
        className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-cyan-200 marker:content-none [&::-webkit-details-marker]:hidden"
        data-testid={`help-toggle-${screen}`}
      >
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-700/80 text-xs text-cyan-300"
          >
            ?
          </span>
          {dict.helpTitle}
          <span className="text-xs font-normal text-slate-500 group-open:hidden">
            — {dict.helpOpenHint}
          </span>
          <span className="hidden text-xs font-normal text-slate-500 group-open:inline">
            — {dict.helpCloseHint}
          </span>
        </span>
      </summary>
      <div className="space-y-4 border-t border-slate-800 px-4 py-4 text-sm text-slate-300">
        <p
          className="leading-6 text-slate-400"
          data-testid={`help-summary-${screen}`}
        >
          {hydrated ? help.summary : "\u00a0"}
        </p>
        {hydrated ? (
          <dl className="space-y-3">
            {help.items.map((item) => (
              <div key={item.title}>
                <dt className="font-medium text-slate-100">{item.title}</dt>
                <dd className="mt-0.5 leading-6 text-slate-400">{item.body}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </details>
  );
}
