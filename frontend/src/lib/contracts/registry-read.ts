/**
 * Read-only TitleRegistry + AttestationRegistry views for the explorer.
 */

import { Contract, Interface, type Log, type Provider } from "ethers";

import { getReadOnlyEthProvider } from "@/lib/eth-rpc";

/** AssetState enum mirrored from TitleRegistry. */
export type OnChainAssetState =
  | "Unknown"
  | "Active"
  | "Paused"
  | "Frozen";

const STATE_NAMES: OnChainAssetState[] = [
  "Unknown",
  "Active",
  "Paused",
  "Frozen",
];

const TITLE_READ_ABI = [
  "function assetState(bytes32 assetId) view returns (uint8)",
  "function totalIssued(bytes32 assetId) view returns (uint256)",
  "function totalRedeemed(bytes32 assetId) view returns (uint256)",
  "function circulating(bytes32 assetId) view returns (uint256)",
  "function balanceOf(bytes32 assetId, bytes32 holder) view returns (uint256)",
  "function entryCount(bytes32 assetId) view returns (uint256)",
  "function entryHash(bytes32 assetId, uint256 index) view returns (bytes32)",
  "function dataHashAt(bytes32 assetId, uint256 index) view returns (bytes32)",
  "function verifyLedger(bytes32 assetId) view returns (bool)",
  "event AssetCreated(bytes32 indexed assetId, uint8 state)",
  "event Issued(bytes32 indexed assetId, bytes32 indexed to, uint256 amount, bytes32 entryHash)",
] as const;

const ATTEST_READ_ABI = [
  "function isCertified(bytes32 assetId) view returns (bool)",
] as const;

const IDENTITY_READ_ABI = [
  "function isVerified(bytes32 holder) view returns (bool)",
] as const;

const titleIface = new Interface(TITLE_READ_ABI);

/** Public RPC eth_getLogs window (Sepolia public nodes ≈ 50k). */
export const LOG_LOOKBACK_BLOCKS = 45_000;

export interface OnChainAssetSummary {
  assetId: string;
  state: OnChainAssetState;
  source: "onchain";
}

export interface OnChainAssetDetail {
  assetId: string;
  state: OnChainAssetState;
  certified: boolean;
  totalIssued: string;
  circulating: string;
  ledgerOk: boolean;
  entries: Array<{ prevHash: string; data: string; entryHash: string }>;
  holders: Array<{ address: string; amount: string }>;
}

export interface IssuePreflight {
  state: OnChainAssetState;
  needsCreate: boolean;
  certified: boolean;
  holderVerified: boolean;
  ok: boolean;
  reason?: string;
}

function stateFromUint(n: number): OnChainAssetState {
  return STATE_NAMES[n] ?? "Unknown";
}

/**
 * Read assetState(assetId).
 */
export async function readAssetState(
  titleAddress: string,
  assetId: string,
): Promise<OnChainAssetState> {
  const provider = getReadOnlyEthProvider();
  const titles = new Contract(titleAddress, TITLE_READ_ABI, provider);
  const raw = Number(await titles.assetState(assetId));
  return stateFromUint(raw);
}

/**
 * Preflight checks before createAsset + issue (no wallet tx).
 * Prefer a wallet/BrowserProvider when available (public RPCs can hang in-browser).
 */
export async function readIssuePreflight(
  titleAddress: string,
  attestationAddress: string,
  identityAddress: string,
  assetId: string,
  toHolder: string,
  provider?: Provider,
): Promise<IssuePreflight> {
  const p = provider ?? getReadOnlyEthProvider();
  const titles = new Contract(titleAddress, TITLE_READ_ABI, p);
  const attest = new Contract(attestationAddress, ATTEST_READ_ABI, p);
  const identity = new Contract(identityAddress, IDENTITY_READ_ABI, p);

  const [stateRaw, certified, holderVerified] = await Promise.all([
    titles.assetState(assetId) as Promise<bigint | number>,
    attest.isCertified(assetId) as Promise<boolean>,
    identity.isVerified(toHolder) as Promise<boolean>,
  ]);
  const state = stateFromUint(Number(stateRaw));
  const needsCreate = state === "Unknown";

  if (state === "Paused" || state === "Frozen") {
    return {
      state,
      needsCreate: false,
      certified,
      holderVerified,
      ok: false,
      reason: `AssetNotActive: el lote está ${state}; no se puede emitir.`,
    };
  }
  if (!certified) {
    return {
      state,
      needsCreate,
      certified,
      holderVerified,
      ok: false,
      reason:
        "CertificationExpired: certificá existencia + registral (quórum) para este assetId antes de emitir.",
    };
  }
  if (!holderVerified) {
    return {
      state,
      needsCreate,
      certified,
      holderVerified,
      ok: false,
      reason:
        "NotVerified: el holder destinatario no está verificado en IdentityRegistry.",
    };
  }
  return {
    state,
    needsCreate,
    certified,
    holderVerified,
    ok: true,
  };
}

/**
 * List assetIds seen via AssetCreated in the recent log window.
 */
export async function listCreatedAssetIds(
  titleAddress: string,
  lookback = LOG_LOOKBACK_BLOCKS,
): Promise<string[]> {
  const provider = getReadOnlyEthProvider();
  const latest = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latest - lookback);
  const topic = titleIface.getEvent("AssetCreated")!.topicHash;
  const logs = await provider.getLogs({
    address: titleAddress,
    fromBlock,
    toBlock: latest,
    topics: [topic],
  });
  const ids = new Set<string>();
  for (const log of logs) {
    const parsed = titleIface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });
    if (parsed?.args?.assetId) {
      ids.add(String(parsed.args.assetId).toLowerCase());
    }
  }
  return [...ids];
}

/**
 * Load explorer detail for one asset (state, cert, ledger, holders from Issued).
 */
export async function readOnChainAssetDetail(
  titleAddress: string,
  attestationAddress: string,
  assetId: string,
  lookback = LOG_LOOKBACK_BLOCKS,
): Promise<OnChainAssetDetail | null> {
  const provider = getReadOnlyEthProvider();
  const titles = new Contract(titleAddress, TITLE_READ_ABI, provider);
  const attest = new Contract(attestationAddress, ATTEST_READ_ABI, provider);

  const stateRaw = Number(await titles.assetState(assetId));
  const state = stateFromUint(stateRaw);
  if (state === "Unknown") {
    return null;
  }

  const [certified, totalIssued, circulating, count, ledgerOk] =
    await Promise.all([
      attest.isCertified(assetId) as Promise<boolean>,
      titles.totalIssued(assetId) as Promise<bigint>,
      titles.circulating(assetId) as Promise<bigint>,
      titles.entryCount(assetId) as Promise<bigint>,
      titles.verifyLedger(assetId) as Promise<boolean>,
    ]);

  const n = Number(count);
  const entries: OnChainAssetDetail["entries"] = [];
  let prev =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  for (let i = 0; i < n; i++) {
    const [entryHash, dataHash] = await Promise.all([
      titles.entryHash(assetId, i) as Promise<string>,
      titles.dataHashAt(assetId, i) as Promise<string>,
    ]);
    entries.push({
      prevHash: prev,
      data: dataHash,
      entryHash,
    });
    prev = entryHash;
  }

  const holders = await readHoldersFromIssued(
    provider,
    titleAddress,
    assetId,
    lookback,
  );

  return {
    assetId: assetId.toLowerCase(),
    state,
    certified,
    totalIssued: totalIssued.toString(),
    circulating: circulating.toString(),
    ledgerOk,
    entries,
    holders,
  };
}

async function readHoldersFromIssued(
  provider: ReturnType<typeof getReadOnlyEthProvider>,
  titleAddress: string,
  assetId: string,
  lookback: number,
): Promise<Array<{ address: string; amount: string }>> {
  const latest = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latest - lookback);
  const issuedTopic = titleIface.getEvent("Issued")!.topicHash;
  const assetTopic = "0x" + assetId.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
  let logs: Log[] = [];
  try {
    logs = await provider.getLogs({
      address: titleAddress,
      fromBlock,
      toBlock: latest,
      topics: [issuedTopic, assetTopic],
    });
  } catch {
    return [];
  }

  const totals = new Map<string, bigint>();
  for (const log of logs) {
    const parsed = titleIface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });
    if (!parsed) continue;
    const to = String(parsed.args.to).toLowerCase();
    const amount = BigInt(parsed.args.amount);
    totals.set(to, (totals.get(to) ?? 0n) + amount);
  }
  return [...totals.entries()].map(([address, amount]) => ({
    address,
    amount: amount.toString(),
  }));
}
