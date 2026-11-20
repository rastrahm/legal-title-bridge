"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TransactionRequest } from "ethers";

import { ConfirmTxPanel } from "@/components/ConfirmTxPanel";
import { NetworkBanner } from "@/components/NetworkBanner";
import { useApp } from "@/components/Providers";
import { resolveAddresses } from "@/lib/addresses";
import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import {
  canCourtOrder,
  canIssue,
  canPause,
  canReconcile,
} from "@/lib/roles";
import { t } from "@/lib/i18n";
import {
  decodeTransactionRequest,
  encodeIssueCall,
  encodePauseCall,
} from "@/lib/tx/decode";
import { simulateTransaction } from "@/lib/tx/simulate";

export interface OperadorClientProps {
  e2eChain?: number | null;
  e2ePrepareIssue?: boolean;
}

/**
 * Operator console client — lab flags as props from the server page.
 */
export function OperadorClient({
  e2eChain = null,
  e2ePrepareIssue = false,
}: OperadorClientProps) {
  const {
    locale,
    roles,
    ethAddress,
    setEthAddress,
    setDemo,
    demo,
    solGenesisHash,
    setRoles,
  } = useApp();
  const dict = t(locale);
  const addresses = resolveAddresses();
  const ethChainId = e2eChain ?? 31337;
  const guard = useNetworkGuard({ ethChainId, solGenesisHash });
  const canSignEth = guard.canSignEth && Boolean(ethAddress);

  const [formAmount, setFormAmount] = useState("1");
  const [formTo, setFormTo] = useState(
    "0x2222222222222222222222222222222222222222",
  );
  const [pendingTx, setPendingTx] = useState<TransactionRequest | null>(null);
  const [simOk, setSimOk] = useState<boolean | null>(null);
  const [simErr, setSimErr] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const prevEth = useRef(ethAddress);

  const assetId =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  useEffect(() => {
    if (prevEth.current != null && prevEth.current !== ethAddress) {
      setPendingTx(null);
      setSimOk(null);
      setSimErr(undefined);
      setNotice(dict.draftCleared);
    }
    prevEth.current = ethAddress;
  }, [ethAddress, dict.draftCleared]);

  const labIssueTx = useMemo((): TransactionRequest | null => {
    if (!e2ePrepareIssue) return null;
    try {
      return {
        to: addresses.titleRegistry,
        data: encodeIssueCall(
          assetId,
          "0x2222222222222222222222222222222222222222",
          BigInt(5),
        ),
        value: BigInt(0),
      };
    } catch {
      return null;
    }
  }, [e2ePrepareIssue, addresses.titleRegistry, assetId]);

  const activeTx = pendingTx ?? labIssueTx;
  const decoded = useMemo(
    () => (activeTx ? decodeTransactionRequest(activeTx) : null),
    [activeTx],
  );
  const labSimOk = e2ePrepareIssue && labIssueTx != null ? true : simOk;

  async function prepareIssue() {
    if (!ethAddress) {
      setNotice(dict.connectWalletFirst);
      return;
    }
    if (busy || pendingTx) return;
    setBusy(true);
    setNotice(null);
    try {
      const amount = BigInt(5);
      const to = "0x2222222222222222222222222222222222222222";
      const data = encodeIssueCall(assetId, to, amount);
      const tx: TransactionRequest = {
        to: addresses.titleRegistry,
        data,
        value: BigInt(0),
      };
      setPendingTx(tx);
      const sim = await simulateTransaction(
        {
          async call() {
            return "0x";
          },
        },
        tx,
      );
      setSimOk(sim.ok);
      setSimErr(sim.ok ? undefined : sim.error);
    } catch (err: unknown) {
      setPendingTx(null);
      setSimOk(false);
      setSimErr(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-10">
      <NetworkBanner
        visible={!guard.ethOk || !guard.solOk}
        message={dict.networkMismatch}
      />
      <h1 className="text-3xl font-bold">{dict.navOperator}</h1>

      <button
        type="button"
        className="rounded-full border border-slate-700 px-4 py-2 text-sm"
        data-testid="btn-connect-eth"
        onClick={() =>
          setEthAddress(
            ethAddress === "0x1111111111111111111111111111111111111111"
              ? "0x3333333333333333333333333333333333333333"
              : "0x1111111111111111111111111111111111111111",
          )
        }
      >
        {dict.connectEth}
      </button>
      <p className="text-sm text-slate-400" data-testid="eth-address">
        {ethAddress ?? "—"}
      </p>

      <button
        type="button"
        className="rounded-full border border-slate-700 px-3 py-1 text-xs"
        data-testid="btn-strip-roles"
        onClick={() =>
          setRoles({
            issuer: false,
            operator: false,
            courtExecutor: false,
            guardian: false,
            verifier: false,
            attestor: false,
          })
        }
      >
        {dict.stripRolesLab}
      </button>

      {notice ? (
        <p role="status" className="text-sm text-amber-200" data-testid="op-notice">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm" htmlFor="form-amount">
          {dict.formAmount}
          <input
            id="form-amount"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
            value={formAmount}
            onChange={(e) => setFormAmount(e.target.value)}
            data-testid="form-amount"
          />
        </label>
        <label className="text-sm" htmlFor="form-to">
          {dict.formRecipient}
          <input
            id="form-to"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
            value={formTo}
            onChange={(e) => setFormTo(e.target.value)}
            data-testid="form-to"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="btn-issue"
          className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
          disabled={!canSignEth || !canIssue(roles) || demo.paused || busy || pendingTx != null}
          onClick={() => void prepareIssue()}
        >
          {dict.btnIssue}
        </button>
        <button
          type="button"
          data-testid="btn-pause"
          className="rounded-full border border-slate-600 px-4 py-2 text-sm disabled:opacity-40"
          disabled={!canSignEth || !canPause(roles)}
          onClick={() => {
            setPendingTx({
              to: addresses.bridgeEndpoint,
              data: encodePauseCall(),
              value: BigInt(0),
            });
            setSimOk(true);
            setDemo((prev) => ({ ...prev, paused: true }));
          }}
        >
          {dict.btnPause}
        </button>
        <button
          type="button"
          data-testid="btn-court"
          className="rounded-full border border-slate-600 px-4 py-2 text-sm disabled:opacity-40"
          disabled={!canSignEth || !canCourtOrder(roles)}
          onClick={() =>
            setDemo((prev) => ({
              ...prev,
              messages: [
                {
                  messageId: `forced:court:${Date.now()}`,
                  status: "signed",
                  direction: "eth_to_sol",
                },
                ...prev.messages,
              ],
              requests: prev.requests.map((r) =>
                r.status === "Pending"
                  ? { ...r, status: "Rejected", rejectReason: "COURT_ORDER" }
                  : r,
              ),
            }))
          }
        >
          {dict.btnCourt}
        </button>
        <button
          type="button"
          data-testid="btn-reconcile"
          className="rounded-full border border-slate-600 px-4 py-2 text-sm disabled:opacity-40"
          disabled={!canSignEth || !canReconcile(roles)}
          onClick={() =>
            setDemo((prev) => ({
              ...prev,
              ethCirculating: prev.solIssued,
              messages: [
                {
                  messageId: `reconcile:d6:${Date.now()}`,
                  status: "delivered",
                  direction: "eth_to_sol",
                },
                ...prev.messages,
              ],
            }))
          }
        >
          {dict.btnReconcile}
        </button>
      </div>

      {decoded ? (
        <ConfirmTxPanel
          title={dict.confirmTitle}
          hint={dict.confirmHint}
          decoded={decoded}
          simulationOk={labSimOk}
          simulationError={simErr}
          disabled={!canSignEth}
          confirmLabel={dict.btnSign}
          simOkLabel={dict.simOk}
          simFailLabel={dict.simFail}
          onConfirm={() => {
            setDemo((prev) => ({
              ...prev,
              ethCirculating: String(BigInt(prev.ethCirculating) + BigInt(5)),
              solIssued: String(BigInt(prev.solIssued) + BigInt(5)),
            }));
            setPendingTx(null);
          }}
        />
      ) : null}

      <p className="sr-only" data-testid="form-mirror">
        {formAmount}:{formTo}
      </p>
    </main>
  );
}
