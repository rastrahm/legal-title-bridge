/**
 * Solana Devnet constants for title_mirror DvP (lab).
 */

import { PublicKey } from "@solana/web3.js";

import { resolveAddresses } from "@/lib/addresses";
import { DEMO_ASSET_ID } from "@/lib/demo/store";

/** Title Token-2022 mint from TESTNET apply_issue. */
export const DEVNET_TITLE_MINT = new PublicKey(
  "6HDbgKmdmoBhLjfVNciZiV4tVYDqyTL3LK9Ei6qtQZMU",
);

/** Config PDA from shared/deployments/sepolia-devnet.json. */
export const DEVNET_CONFIG_PDA = new PublicKey(
  "A9j9D6XGUC94SLcpGhK8AyCJReyVu6oGKdD1QRdDm4KU",
);

/** Eth/Sol asset id used for the issued lot on Devnet. */
export const DEVNET_ASSET_ID_HEX = DEMO_ASSET_ID;

export const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);

export function programId(): PublicKey {
  return new PublicKey(resolveAddresses().solana);
}

export function solanaRpcUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
  if (fromEnv) return fromEnv;
  return "https://api.devnet.solana.com";
}

/**
 * Lab USD payment mint (Token-2022, 0 decimals) on Devnet.
 * Override with NEXT_PUBLIC_PAYMENT_MINT; fallback is the lab mint from secrets/deploy.
 */
export const DEVNET_PAYMENT_MINT = "QfLrv6dAFAwc3sfjMiuB4x5W7yPtFrwk7GgJsCEUX2i";

/** Lab payment mint (Token-2022). Env wins; else Devnet lab default. */
export function defaultPaymentMint(): string {
  const fromEnv = process.env.NEXT_PUBLIC_PAYMENT_MINT?.trim();
  if (fromEnv) return fromEnv;
  return DEVNET_PAYMENT_MINT;
}

export function assetIdBytes(hex: string = DEVNET_ASSET_ID_HEX): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length !== 64) throw new Error("assetId must be 32 bytes hex");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
