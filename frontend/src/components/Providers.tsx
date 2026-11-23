"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { AppNav } from "@/components/AppNav";
import { NetworkBanner } from "@/components/NetworkBanner";
import { useLocale } from "@/hooks/useLocale";
import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import { getActiveNetwork } from "@/lib/config/network";
import {
  loadPersistedMarket,
  savePersistedMarket,
} from "@/lib/demo/persist";
import { createDemoState, type DemoState } from "@/lib/demo/store";
import type { Locale } from "@/lib/i18n";
import type { RoleFlags } from "@/lib/roles";
import { EMPTY_ROLES } from "@/lib/roles";
import { isE2eLab } from "@/lib/wallets/env";

export interface AppContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  demo: DemoState;
  setDemo: (updater: (prev: DemoState) => DemoState) => void;
  ethChainId: number | null;
  setEthChainId: (id: number | null) => void;
  solGenesisHash: string | null;
  setSolGenesisHash: (h: string | null) => void;
  ethAddress: string | null;
  setEthAddress: (a: string | null) => void;
  solAddress: string | null;
  setSolAddress: (a: string | null) => void;
  roles: RoleFlags;
  setRoles: (r: RoleFlags) => void;
  canSignEth: boolean;
  canSignSol: boolean;
  e2eFakeRelayer: boolean;
  e2ePrepareIssue: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

/**
 * Client shell: locale, demo store, wallet network state for guards.
 */
export function Providers({ children }: { children: ReactNode }) {
  const { locale, dict, setLocale } = useLocale("es");
  const [demo, setDemoState] = useState(() => createDemoState());
  // Local / E2E: pre-seed both so Playwright stubs pass W2 without extensions.
  // Sepolia+Devnet: Eth starts disconnected; Sol genesis is the known Devnet hash
  // (Phantom connect re-checks via RPC). Banner clears once MetaMask is on Sepolia.
  const bootNet = getActiveNetwork();
  const seedLab = isE2eLab() || bootNet.networkId === "local";
  const [ethChainId, setEthChainId] = useState<number | null>(
    seedLab ? bootNet.ethChainId : null,
  );
  const [solGenesisHash, setSolGenesisHash] = useState<string | null>(
    seedLab || bootNet.networkId === "sepolia-devnet"
      ? bootNet.solanaGenesisHash
      : null,
  );
  const [ethAddress, setEthAddress] = useState<string | null>(null);
  const [solAddress, setSolAddress] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleFlags>({
    ...EMPTY_ROLES,
    issuer: true,
    operator: true,
    courtExecutor: true,
    guardian: true,
    verifier: true,
    attestor: true,
  });

  const guard = useNetworkGuard({ ethChainId, solGenesisHash });
  // Client-only flag for Playwright (SSR snapshot stays "0"; no setState-in-effect).
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Restore listings/offers after mount (SSR stays seed — no hydration mismatch).
  useEffect(() => {
    const saved = loadPersistedMarket();
    if (!saved) return;
    setDemoState((prev) => ({
      ...prev,
      listings: saved.listings,
      requests: saved.requests,
    }));
  }, []);

  const setDemo = (updater: (prev: DemoState) => DemoState) =>
    setDemoState((prev) => {
      const next = updater(prev);
      savePersistedMarket({
        listings: next.listings,
        requests: next.requests,
      });
      return next;
    });

  const value = useMemo<AppContextValue>(
    () => ({
      locale,
      setLocale,
      demo,
      setDemo,
      ethChainId,
      setEthChainId,
      solGenesisHash,
      setSolGenesisHash,
      ethAddress,
      setEthAddress,
      solAddress,
      setSolAddress,
      roles,
      setRoles,
      canSignEth: guard.canSignEth,
      canSignSol: guard.canSignSol,
      e2eFakeRelayer: false,
      e2ePrepareIssue: false,
    }),
    [
      locale,
      setLocale,
      demo,
      ethChainId,
      solGenesisHash,
      ethAddress,
      solAddress,
      roles,
      guard.canSignEth,
      guard.canSignSol,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      <AppNav dict={dict} locale={locale} onLocaleChange={setLocale} />
      <NetworkBanner
        // Only warn when a *connected* wallet is on the wrong network (W2).
        // Avoid false alarms on /cartera when MetaMask is not connected yet.
        visible={
          (Boolean(ethAddress) && !guard.ethOk) ||
          (Boolean(solAddress) && !guard.solOk)
        }
        message={dict.networkMismatch}
      />
      <div
        data-testid="e2e-toolbar"
        data-ready="1"
        data-hydrated={hydrated ? "1" : "0"}
        hidden
      />
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp requires Providers");
  return ctx;
}
