/**
 * In-memory demo store for local UI / Playwright without live RPCs.
 * Ledger hashes are precomputed so SSR/CSR never call keccak at boot.
 */

import type { LedgerEntry } from "../ledger";

export const DEMO_ASSET_ID =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/** Precomputed: keccak256(prev || utf8(data)) — see ledger.test.ts / Gen. */
const DEMO_ENTRIES: LedgerEntry[] = [
  {
    prevHash: ZERO,
    data: `issue:${DEMO_ASSET_ID}:100`,
    entryHash:
      "0x677a325cdbb94194dadf61724ce5c3f5b58a199c6e6d72904e489911b2e4e512",
  },
  {
    prevHash:
      "0x677a325cdbb94194dadf61724ce5c3f5b58a199c6e6d72904e489911b2e4e512",
    data: `transfer:${DEMO_ASSET_ID}:seller:buyer:10`,
    entryHash:
      "0x72c3dd4674362385f1666a383a58480a20ece7f5f96a91b5bf82bf38a5503274",
  },
];

export interface DemoAsset {
  assetId: string;
  name: string;
  description: string;
  holders: Array<{ address: string; amount: string }>;
  entries: LedgerEntry[];
  certifications: Array<{
    kind: string;
    expiresAt: number;
    active: boolean;
  }>;
}

export interface DemoRequest {
  transferId: string;
  assetId: string;
  seller: string;
  buyer: string;
  amount: string;
  deadline: number;
  hardDeadline: number;
  status: "Pending" | "Approved" | "Rejected" | "Expired" | "Refunded";
  rejectReason?: string;
}

export interface DemoState {
  assets: Record<string, DemoAsset>;
  requests: DemoRequest[];
  ethCirculating: string;
  solIssued: string;
  ethBalances: Record<string, string>;
  solBalances: Record<string, string>;
  messages: Array<{
    messageId: string;
    status: "seen" | "finalized" | "signed" | "delivered";
    direction: "eth_to_sol" | "sol_to_eth";
  }>;
  paused: boolean;
  ledgerReady: boolean;
}

/** Deterministic demo world (safe for SSR + CSR). */
export function createDemoState(now = 1_700_000_000): DemoState {
  return {
    assets: {
      [DEMO_ASSET_ID]: {
        assetId: DEMO_ASSET_ID,
        name: "Lote Rioja 2019",
        description: "https://example.com/rioja",
        holders: [
          {
            address: "0x1111111111111111111111111111111111111111",
            amount: "90",
          },
          {
            address: "0x2222222222222222222222222222222222222222",
            amount: "10",
          },
        ],
        entries: DEMO_ENTRIES,
        certifications: [
          { kind: "existence", expiresAt: now + 86400 * 30, active: true },
          { kind: "registry", expiresAt: now - 10, active: false },
        ],
      },
    },
    requests: [
      {
        transferId: "0xbb",
        assetId: DEMO_ASSET_ID,
        seller: "seller-sol",
        buyer: "buyer-sol",
        amount: "5",
        deadline: now + 3600,
        hardDeadline: now + 3600 + 7 * 86400,
        status: "Pending",
      },
      {
        transferId: "0xcert-expired",
        assetId: DEMO_ASSET_ID,
        seller: "seller-sol",
        buyer: "buyer-sol",
        amount: "2",
        deadline: now + 1800,
        hardDeadline: now + 1800 + 7 * 86400,
        status: "Rejected",
        rejectReason: "CERTIFICATION_EXPIRED",
      },
    ],
    ethCirculating: "100",
    solIssued: "100",
    ethBalances: {
      "0x1111111111111111111111111111111111111111": "90",
      "0x2222222222222222222222222222222222222222": "10",
    },
    solBalances: {
      "seller-sol": "90",
      "buyer-sol": "10",
    },
    messages: [
      {
        messageId: "decision:demo:Approved",
        status: "delivered",
        direction: "eth_to_sol",
      },
      {
        messageId: "issue:demo",
        status: "signed",
        direction: "eth_to_sol",
      },
    ],
    paused: false,
    ledgerReady: true,
  };
}
