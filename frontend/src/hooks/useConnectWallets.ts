"use client";

import { useCallback, useState } from "react";

import { useApp } from "@/components/Providers";
import { getActiveNetwork } from "@/lib/config/network";
import { isE2eLab } from "@/lib/wallets/env";
import {
  connectMetaMaskE2eStub,
  connectMetaMaskOnExpectedNetwork,
} from "@/lib/wallets/ethereum";
import {
  connectPhantom,
  connectPhantomE2eStub,
} from "@/lib/wallets/solana";

/**
 * Connect MetaMask / Phantom — real extensions on testnet, stubs under E2E.
 */
export function useConnectWallets() {
  const {
    ethAddress,
    setEthAddress,
    setEthChainId,
    setSolAddress,
    setSolGenesisHash,
  } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connectEth = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      if (isE2eLab()) {
        const stub = connectMetaMaskE2eStub(ethAddress);
        setEthAddress(stub.address);
        setEthChainId(stub.chainId);
        return stub;
      }
      const expected = getActiveNetwork().ethChainId;
      const conn = await connectMetaMaskOnExpectedNetwork(expected);
      setEthAddress(conn.address);
      setEthChainId(conn.chainId);
      return conn;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [ethAddress, setEthAddress, setEthChainId]);

  const connectSol = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const net = getActiveNetwork();
      if (isE2eLab()) {
        const stub = connectPhantomE2eStub(net.solanaGenesisHash);
        setSolAddress(stub.address);
        setSolGenesisHash(stub.genesisHash);
        return stub;
      }
      const conn = await connectPhantom(net.solanaGenesisHash, net.networkId);
      setSolAddress(conn.address);
      setSolGenesisHash(conn.genesisHash);
      return conn;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [setSolAddress, setSolGenesisHash]);

  return { connectEth, connectSol, error, busy };
}
