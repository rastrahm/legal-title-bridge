import { describe, expect, it } from "vitest";

import { decodeSolanaPubkey, holderIdFromSolanaAddress } from "./holder";

describe("holderIdFromSolanaAddress", () => {
  it("maps a real Devnet pubkey to 32-byte hex (D2)", () => {
    const addr = "EDTzyw3P2wwaLu9VyFUs5EjXziCHaSXCQkbJWhDwM4x5";
    const bytes = decodeSolanaPubkey(addr);
    expect(bytes.length).toBe(32);
    expect(holderIdFromSolanaAddress(addr)).toBe(
      "0xc4596daaf354c9835802d722e528f1852d2e203dbf801838cf8c13d6eb414766",
    );
  });

  it("maps lab stubs to a stable keccak holder id", () => {
    const a = holderIdFromSolanaAddress("seller-sol");
    const b = holderIdFromSolanaAddress("seller-sol");
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a).toBe(b);
    expect(a).not.toBe(holderIdFromSolanaAddress("buyer-sol"));
  });
});
