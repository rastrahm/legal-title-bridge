/**
 * Cartera purchase helpers — demo vs on-chain DvP with Phantom.
 */

import { PublicKey } from "@solana/web3.js";

import type { DvPHandoffPayload } from "@/lib/cartera/dvp-handoff";
import { getActiveNetwork } from "@/lib/config/network";
import { defaultPaymentMint } from "@/lib/solana/config";
import { isE2eLab } from "@/lib/wallets/env";
import { getPhantom } from "@/lib/wallets/solana";

export function isSolanaPubkey(value: string): boolean {
  try {
    return new PublicKey(value).toBase58().length > 0;
  } catch {
    return false;
  }
}

export function labPaymentMintOrThrow(): string {
  const mint = defaultPaymentMint();
  if (!mint) {
    throw new Error(
      "Falta Lab USD: definí NEXT_PUBLIC_PAYMENT_MINT en frontend/.env.local (mint Token-2022 en Devnet).",
    );
  }
  return mint;
}

/**
 * Ensure Phantom is unlocked and connected before building txs.
 */
export async function ensurePhantomConnected(): Promise<string> {
  const phantom = getPhantom();
  if (!phantom) {
    throw new Error("Phantom no encontrado. Instalalo y usá Devnet.");
  }
  const { publicKey } = await phantom.connect();
  return publicKey.toString();
}

/**
 * Silent UI-only buy/accept — Playwright local lab only.
 * Sepolia+Devnet always uses Phantom DvP (never fake "aceptar").
 */
export function useDemoPurchasePath(): boolean {
  if (getActiveNetwork().networkId === "sepolia-devnet") return false;
  return isE2eLab();
}

function assertDvPParties(seller: string, buyer: string): void {
  if (!isSolanaPubkey(seller) || !isSolanaPubkey(buyer)) {
    throw new Error(
      "Vendedor o comprador no son pubkeys Solana reales (¿ejemplo lab?).",
    );
  }
  if (seller === buyer) {
    throw new Error(
      "No podés cerrar un DvP comprándote a vos mismo. Usá otra cuenta Phantom como contraparte.",
    );
  }
}

/**
 * Seller half: approve + sign request_transfer → handoff payload / share link.
 */
export async function sellerPrepareDvPHandoff(args: {
  seller: string;
  buyer: string;
  titleAmount: string;
  paymentAmount: string;
  assetIdHex: string;
  offerTransferId: string;
  onStatus?: (msg: string) => void;
}) {
  assertDvPParties(args.seller, args.buyer);
  const paymentMint = labPaymentMintOrThrow();
  await ensurePhantomConnected();
  const { sellerPrepareDvPPartial } = await import("@/lib/solana/dvp");
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  return sellerPrepareDvPPartial({
    seller: args.seller,
    buyer: args.buyer,
    amount: BigInt(args.titleAmount || "0"),
    paymentAmount: BigInt(args.paymentAmount || "0"),
    paymentMint,
    deadline,
    assetIdHex: args.assetIdHex,
    offerTransferId: args.offerTransferId,
    onStatus: args.onStatus,
  });
}

/**
 * Buyer half: sign handoff tx and send (other PC or same Phantom).
 */
export async function buyerCompleteDvPHandoff(
  payload: DvPHandoffPayload,
  onStatus?: (msg: string) => void,
) {
  assertDvPParties(payload.seller, payload.buyer);
  await ensurePhantomConnected();
  const { buyerCompleteDvPPartial } = await import("@/lib/solana/dvp");
  return buyerCompleteDvPPartial(payload, onStatus);
}

/**
 * Same-device: seller prepare + buyer switch in one call (legacy helper).
 */
export async function closeDvPWithPhantom(args: {
  seller: string;
  buyer: string;
  titleAmount: string;
  paymentAmount: string;
  assetIdHex: string;
  onStatus?: (msg: string) => void;
}): Promise<{ signature: string; transferIdHex: string; escrow: string }> {
  assertDvPParties(args.seller, args.buyer);
  const paymentMint = labPaymentMintOrThrow();
  await ensurePhantomConnected();
  const { requestTransferOnChain } = await import("@/lib/solana/dvp");
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  return requestTransferOnChain({
    seller: args.seller,
    buyer: args.buyer,
    amount: BigInt(args.titleAmount || "0"),
    paymentAmount: BigInt(args.paymentAmount || "0"),
    paymentMint,
    deadline,
    assetIdHex: args.assetIdHex,
    onStatus: args.onStatus,
  });
}
