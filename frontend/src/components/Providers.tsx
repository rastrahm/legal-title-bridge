"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { AppNav } from "@/components/AppNav";
import { NetworkBanner } from "@/components/NetworkBanner";
import { useLocale } from "@/hooks/useLocale";
import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import { createDemoState, type DemoState } from "@/lib/demo/store";
import type { Locale } from "@/lib/i18n";
import type { RoleFlags } from "@/lib/roles";
import { EMPTY_ROLES } from "@/lib/roles";

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
  const [ethChainId, setEthChainId] = useState<number | null>(31337);
  const [solGenesisHash, setSolGenesisHash] = useState<string | null>(
    "11111111111111111111111111111111",
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

  const setDemo = (updater: (prev: DemoState) => DemoState) =>
    setDemoState((prev) => updater(prev));

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
        visible={!guard.ethOk || !guard.solOk}
        message={dict.networkMismatch}
      />
      <div data-testid="e2e-toolbar" data-ready="1" hidden />
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp requires Providers");
  return ctx;
}
