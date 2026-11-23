"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TransactionRequest } from "ethers";

import { ConfirmTxPanel } from "@/components/ConfirmTxPanel";
import { ContextualHelp } from "@/components/ContextualHelp";
import { NetworkBanner } from "@/components/NetworkBanner";
import { useApp } from "@/components/Providers";
import { resolveAddresses } from "@/lib/addresses";
import { useConnectWallets } from "@/hooks/useConnectWallets";
import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import {
  canCourtOrder,
  canIssue,
  canPause,
  canReconcile,
} from "@/lib/roles";
import { t } from "@/lib/i18n";
import { formatRegistryError } from "@/lib/contracts/registry-errors";
import {
  createAssetAndIssueOnChain,
  sendPreparedTx,
  simulateFromWallet,
} from "@/lib/contracts/registry";
import { readIssuePreflight } from "@/lib/contracts/registry-read";
import {
  decodeTransactionRequest,
  encodeCreateAssetCall,
  encodeDecideCall,
  encodeIssueCall,
  encodePauseCall,
} from "@/lib/tx/decode";
import { simulateTransaction } from "@/lib/tx/simulate";
import { isE2eLab } from "@/lib/wallets/env";
import { getMetaMaskBrowserProvider } from "@/lib/wallets/provider";

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
    ethChainId: appEthChainId,
    setDemo,
    demo,
    solGenesisHash,
    setRoles,
  } = useApp();
  const { connectEth, error: connectError, busy: connectBusy } =
    useConnectWallets();
  const dict = t(locale);
  const addresses = resolveAddresses();
  // URL e2eChain overrides app state (EXTATK X33 / Playwright); else live MetaMask chain.
  const ethChainId = e2eChain ?? appEthChainId;
  const guard = useNetworkGuard({ ethChainId, solGenesisHash });
  const canSignEth = guard.canSignEth && Boolean(ethAddress);

  const [formAmount, setFormAmount] = useState("1000");
  const [formTo, setFormTo] = useState(
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  );
  const [formAssetId, setFormAssetId] = useState(
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [pendingTx, setPendingTx] = useState<TransactionRequest | null>(null);
  const [simOk, setSimOk] = useState<boolean | null>(null);
  const [simErr, setSimErr] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [decideTransferId, setDecideTransferId] = useState("");
  const prevEth = useRef(ethAddress);

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
          formAssetId,
          BigInt(5),
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ),
        value: BigInt(0),
      };
    } catch {
      return null;
    }
  }, [e2ePrepareIssue, addresses.titleRegistry, formAssetId]);

  const activeTx = pendingTx ?? labIssueTx;
  const decoded = useMemo(
    () => (activeTx ? decodeTransactionRequest(activeTx) : null),
    [activeTx],
  );
  const labSimOk = e2ePrepareIssue && labIssueTx != null ? true : simOk;

  function clearDraft(message?: string) {
    setPendingTx(null);
    setSimOk(null);
    setSimErr(undefined);
    setNotice(message ?? null);
  }

  async function prepareIssue() {
    if (!ethAddress) {
      setNotice(dict.connectWalletFirst);
      return;
    }
    // Always allow re-prepare: a failed issue-only draft used to lock Emitir forever.
    if (busy) return;
    setBusy(true);
    setNotice(dict.issuePreparing);
    setLastTxHash(null);
    setPendingTx(null);
    setSimOk(null);
    setSimErr(undefined);
    try {
      const amount = BigInt(formAmount || "0");
      if (amount <= 0n) {
        setNotice("Monto debe ser > 0");
        setSimOk(false);
        return;
      }
      if (isE2eLab()) {
        const tx: TransactionRequest = {
          to: addresses.titleRegistry,
          data: encodeIssueCall(formAssetId, amount, formTo),
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
        if (sim.ok) setNotice(dict.issueReady);
      } else {
        // Prefer MetaMask RPC so preflight does not hang on public endpoints.
        const walletProvider = getMetaMaskBrowserProvider();
        const pre = await readIssuePreflight(
          addresses.titleRegistry,
          addresses.attestationRegistry,
          addresses.identityRegistry,
          formAssetId,
          formTo,
          walletProvider,
        );
        // Show the first on-chain step in the confirm panel (W4): create or issue.
        const tx: TransactionRequest = {
          to: addresses.titleRegistry,
          data: pre.needsCreate
            ? encodeCreateAssetCall(formAssetId)
            : encodeIssueCall(formAssetId, amount, formTo),
          value: BigInt(0),
        };
        setPendingTx(tx);
        if (!pre.ok) {
          setSimOk(false);
          setSimErr(pre.reason);
          setNotice(pre.reason ?? null);
        } else {
          setSimOk(true);
          setSimErr(undefined);
          setNotice(
            pre.needsCreate ? dict.issueNeedsCreate : dict.issueReady,
          );
          // Bring W4 confirm into view — Emitir alone does not send the tx.
          queueMicrotask(() => {
            document
              .querySelector("[data-testid='btn-confirm-sign']")
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        }
      }
    } catch (err: unknown) {
      const msg = formatRegistryError(err);
      setPendingTx(null);
      setSimOk(false);
      setSimErr(msg);
      setNotice(msg);
    } finally {
      setBusy(false);
    }
  }

  async function confirmIssue() {
    if (!pendingTx?.to || !pendingTx.data) return;
    setBusy(true);
    setNotice("Enviando a MetaMask… confirmá createAsset y/o issue.");
    try {
      if (isE2eLab()) {
        setDemo((prev) => ({
          ...prev,
          ethCirculating: String(BigInt(prev.ethCirculating) + BigInt(formAmount || "5")),
          solIssued: String(BigInt(prev.solIssued) + BigInt(formAmount || "5")),
        }));
        setPendingTx(null);
        setNotice(dict.signedOk);
        return;
      }
      const amount = BigInt(formAmount || "0");
      const result = await createAssetAndIssueOnChain(
        addresses.titleRegistry,
        formAssetId,
        amount,
        formTo,
      );
      setLastTxHash(result.issueTxHash);
      const id = formAssetId.toLowerCase();
      setDemo((prev) => {
        const existing = prev.assets[id];
        const holders = existing?.holders ? [...existing.holders] : [];
        const holderIdx = holders.findIndex(
          (h) => h.address.toLowerCase() === formTo.toLowerCase(),
        );
        if (holderIdx >= 0) {
          holders[holderIdx] = {
            ...holders[holderIdx],
            amount: String(BigInt(holders[holderIdx].amount) + amount),
          };
        } else {
          holders.push({ address: formTo.toLowerCase(), amount: amount.toString() });
        }
        return {
          ...prev,
          ethCirculating: String(BigInt(prev.ethCirculating) + amount),
          assets: {
            ...prev.assets,
            [id]: {
              assetId: id,
              name: existing?.name ?? `Lote ${id.slice(0, 10)}…`,
              description: existing?.description ?? "Creado on-chain (Sepolia)",
              holders,
              entries: existing?.entries ?? [],
              certifications: existing?.certifications ?? [
                { kind: "existence", expiresAt: Date.now() / 1000 + 86400 * 30, active: true },
                { kind: "registry", expiresAt: Date.now() / 1000 + 86400 * 30, active: true },
              ],
            },
          },
          messages: [
            {
              messageId: `issue:${result.issueTxHash}`,
              status: "signed",
              direction: "eth_to_sol",
            },
            ...prev.messages,
          ],
        };
      });
      clearDraft(
        result.createTxHash
          ? `createAsset ${result.createTxHash} · issue ${result.issueTxHash}`
          : `issue ${result.issueTxHash}`,
      );
    } catch (err: unknown) {
      setSimOk(false);
      setSimErr(formatRegistryError(err));
      setNotice(formatRegistryError(err));
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
      <ContextualHelp screen="operador" />

      <button
        type="button"
        className="rounded-full border border-slate-700 px-4 py-2 text-sm"
        data-testid="btn-connect-eth"
        disabled={connectBusy}
        onClick={() => {
          void connectEth().catch(() => undefined);
        }}
      >
        {dict.connectEth}
      </button>
      {connectError ? (
        <p role="alert" className="text-sm text-rose-300" data-testid="connect-eth-error">
          {connectError}
        </p>
      ) : null}
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
        <label className="text-sm sm:col-span-2" htmlFor="form-asset">
          Asset id (bytes32)
          <input
            id="form-asset"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
            value={formAssetId}
            onChange={(e) => setFormAssetId(e.target.value)}
            data-testid="form-asset"
          />
        </label>
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
          {dict.formRecipient} (bytes32 holder)
          <input
            id="form-to"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
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
          disabled={
            !canSignEth ||
            !canIssue(roles) ||
            demo.paused ||
            busy ||
            // Lock while a good draft awaits Firmar; keep enabled after failed sim so user can retry.
            (pendingTx != null && simOk !== false)
          }
          onClick={() => void prepareIssue()}
        >
          {dict.btnIssue}
        </button>
        {pendingTx ? (
          <button
            type="button"
            data-testid="btn-clear-draft"
            className="rounded-full border border-slate-600 px-4 py-2 text-sm"
            disabled={busy}
            onClick={() => clearDraft(dict.draftClearedManual)}
          >
            {dict.btnClearDraft}
          </button>
        ) : null}
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
        <button
          type="button"
          data-testid="btn-decide"
          className="rounded-full border border-cyan-700 px-4 py-2 text-sm disabled:opacity-40"
          disabled={
            !canSignEth ||
            !canReconcile(roles) ||
            busy ||
            !decideTransferId.trim() ||
            isE2eLab()
          }
          onClick={() => {
            void (async () => {
              setBusy(true);
              setNotice(null);
              try {
                const data = encodeDecideCall(decideTransferId.trim());
                const tx = {
                  to: addresses.titleRegistry,
                  data,
                  value: 0n,
                };
                const sim = await simulateFromWallet(tx);
                if (!sim.ok) {
                  setNotice(sim.error ?? dict.simFail);
                  return;
                }
                const hash = await sendPreparedTx(tx);
                setLastTxHash(hash);
                setNotice(`decide ${hash}`);
                setDemo((prev) => ({
                  ...prev,
                  messages: [
                    {
                      messageId: `decide:${hash}`,
                      status: "signed",
                      direction: "eth_to_sol",
                    },
                    ...prev.messages,
                  ],
                }));
              } catch (err: unknown) {
                setNotice(formatRegistryError(err));
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Decidir DvP
        </button>
      </div>

      <label className="block max-w-xl text-sm" htmlFor="decide-transfer">
        transferId (decide on-chain, rol operator)
        <input
          id="decide-transfer"
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
          value={decideTransferId}
          onChange={(e) => setDecideTransferId(e.target.value)}
          data-testid="form-decide-transfer"
          placeholder="0x…"
        />
      </label>

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
            void confirmIssue();
          }}
        />
      ) : null}

      {lastTxHash ? (
        <p className="text-sm text-emerald-300 break-all" data-testid="issue-tx-hash">
          {lastTxHash}
        </p>
      ) : null}

      <p className="sr-only" data-testid="form-mirror">
        {formAmount}:{formTo}
      </p>
      <p className="text-xs text-slate-500">
        {dict.issuePressSign} Cuenta{" "}
        <span className="font-mono">issuer</span> en MetaMask. Asset nuevo: quórum
        existencia + registral → Emitir → Firmar (createAsset + issue).
      </p>
    </main>
  );
}
