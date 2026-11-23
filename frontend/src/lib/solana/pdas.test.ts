/** @vitest-environment node */
import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import {
  assetPda,
  configPda,
  escrowAuthorityPda,
  escrowPda,
} from "./pdas";

const PROGRAM = new PublicKey("2DvHn2Hxj3HFsbn2iDuBGL4TQAzTomcVCsDTPoZ2h1JL");
const EXPECTED_CONFIG = new PublicKey(
  "A9j9D6XGUC94SLcpGhK8AyCJReyVu6oGKdD1QRdDm4KU",
);

describe("title_mirror PDAs", () => {
  it("derives config PDA for deployed program", () => {
    expect(configPda(PROGRAM).equals(EXPECTED_CONFIG)).toBe(true);
  });

  it("derives asset / escrow / authority PDAs", () => {
    const assetId = new Uint8Array(32).fill(0xaa);
    const transferId = new Uint8Array(32).fill(0xbb);
    const mint = new PublicKey("6HDbgKmdmoBhLjfVNciZiV4tVYDqyTL3LK9Ei6qtQZMU");
    expect(assetPda(assetId, PROGRAM).toBase58().length).toBeGreaterThan(30);
    expect(escrowPda(transferId, PROGRAM).toBase58().length).toBeGreaterThan(30);
    expect(
      escrowAuthorityPda(mint, PROGRAM).equals(escrowAuthorityPda(mint, PROGRAM)),
    ).toBe(true);
  });
});
