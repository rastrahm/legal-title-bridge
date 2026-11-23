/**
 * On-chain DvP: seller approve + request_transfer (seller then buyer co-sign).
 * Cross-device: sellerPrepareDvPPartial → share link → buyerCompleteDvPPartial.
 */

import "@/lib/solana/polyfill";

import { AnchorProvider, BN, Program, type Idl } from "@coral-xyz/anchor";
import {
  createApproveInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import type { DvPHandoffPayload } from "@/lib/cartera/dvp-handoff";
import idlJson from "@/vendor/idl/title_mirror.json";
import {
  DEVNET_TITLE_MINT,
  TOKEN_2022_PROGRAM_ID,
  assetIdBytes,
  programId,
  solanaRpcUrl,
} from "@/lib/solana/config";
import {
  assetPda,
  configPda,
  escrowAuthorityPda,
  escrowPda,
} from "@/lib/solana/pdas";
import { getPhantom } from "@/lib/wallets/solana";

export interface DvPRequestParams {
  /** Seller pubkey (must match active Phantom when approving / first sign). */
  seller: string;
  /** Buyer pubkey (signs later — same PC switch or /cartera/firmar). */
  buyer: string;
  /** Title units to escrow. */
  amount: bigint;
  /** Payment token amount (raw units). */
  paymentAmount: bigint;
  /** Token-2022 payment mint. */
  paymentMint: string;
  /** Unix deadline (seconds). */
  deadline: number;
  /** Optional asset id hex; defaults to Devnet issued lot. */
  assetIdHex?: string;
  titleMint?: string;
  /** Demo-store offer id embedded in the handoff link. */
  offerTransferId?: string;
  onStatus?: (msg: string) => void;
}

export interface DvPRequestResult {
  signature: string;
  transferIdHex: string;
  escrow: string;
}

function status(cb: DvPRequestParams["onStatus"], msg: string) {
  cb?.(msg);
}

function randomTransferId(): Uint8Array {
  const out = new Uint8Array(32);
  crypto.getRandomValues(out);
  return out;
}

function toHex32(bytes: Uint8Array): string {
  return (
    "0x" +
    [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Wait until Phantom's active pubkey matches `want` (user switches account).
 */
async function waitForPhantomAccount(
  want: PublicKey,
  label: string,
  onStatus?: (msg: string) => void,
  timeoutMs = 120_000,
): Promise<void> {
  const phantom = getPhantom();
  if (!phantom) throw new Error("Phantom not found");
  const start = Date.now();
  status(
    onStatus,
    `Cambiá Phantom a la cuenta ${label} (${want.toBase58().slice(0, 8)}…)`,
  );
  while (Date.now() - start < timeoutMs) {
    const cur = phantom.publicKey?.toString();
    if (cur === want.toBase58()) return;
    await wait(800);
  }
  throw new Error(
    `Timeout esperando cuenta Phantom ${label}. Cambiá de cuenta y reintentá.`,
  );
}

function buildProgram(connection: Connection, payer: PublicKey): Program {
  const wallet = {
    publicKey: payer,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  };
  const provider = new AnchorProvider(connection, wallet as never, {
    commitment: "confirmed",
    skipPreflight: false,
  });
  return new Program(idlJson as Idl, provider);
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return typeof btoa === "function"
    ? btoa(bin)
    : Buffer.from(bytes).toString("base64");
}

function base64ToBytes(b64: string): Uint8Array {
  const raw =
    typeof atob === "function"
      ? atob(b64)
      : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Seller-only: approve title + build request_transfer + seller (+ escrow ATAs) signs.
 * Returns a handoff payload for the buyer (other PC / same Phantom switch).
 */
export async function sellerPrepareDvPPartial(
  params: DvPRequestParams,
): Promise<DvPHandoffPayload> {
  const phantom = getPhantom();
  if (!phantom?.signTransaction) {
    throw new Error("Phantom no expone signTransaction");
  }
  if (!phantom.publicKey) {
    throw new Error("Conectá Phantom primero");
  }

  const seller = new PublicKey(params.seller);
  const buyer = new PublicKey(params.buyer);
  if (seller.equals(buyer)) {
    throw new Error("Vendedor y comprador deben ser cuentas distintas");
  }
  if (!params.paymentMint.trim()) {
    throw new Error("Indicá el payment mint (Token-2022) del colateral");
  }

  const paymentMint = new PublicKey(params.paymentMint.trim());
  const titleMint = params.titleMint
    ? new PublicKey(params.titleMint)
    : DEVNET_TITLE_MINT;
  const assetId = assetIdBytes(params.assetIdHex);
  const transferId = randomTransferId();
  const travelRuleHash = new Uint8Array(32);

  const connection = new Connection(solanaRpcUrl(), "confirmed");
  const program = buildProgram(connection, seller);
  const pid = programId();

  const escrowAuthority = escrowAuthorityPda(titleMint, pid);
  const asset = assetPda(assetId, pid);
  const escrow = escrowPda(transferId, pid);
  const config = configPda(pid);

  const sellerTitleAta = getAssociatedTokenAddressSync(
    titleMint,
    seller,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  const buyerPaymentAta = getAssociatedTokenAddressSync(
    paymentMint,
    buyer,
    false,
    TOKEN_2022_PROGRAM_ID,
  );

  const escrowTitleAta = Keypair.generate();
  const escrowPaymentAta = Keypair.generate();

  await waitForPhantomAccount(seller, "vendedor", params.onStatus);
  status(params.onStatus, "Aprobá en Phantom el allowance del título…");
  const approveIx = createApproveInstruction(
    sellerTitleAta,
    escrowAuthority,
    seller,
    params.amount,
    [],
    TOKEN_2022_PROGRAM_ID,
  );
  const approveTx = new Transaction().add(approveIx);
  approveTx.feePayer = seller;
  approveTx.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;
  const signedApprove = await phantom.signTransaction(approveTx);
  const approveSig = await connection.sendRawTransaction(
    signedApprove.serialize(),
  );
  await connection.confirmTransaction(approveSig, "confirmed");
  status(params.onStatus, `Approve OK ${approveSig.slice(0, 12)}…`);

  status(params.onStatus, "Armando request_transfer (firma vendedor)…");
  const built = await program.methods
    .requestTransfer({
      transferId: Array.from(transferId),
      amount: new BN(params.amount.toString()),
      paymentAmount: new BN(params.paymentAmount.toString()),
      deadline: new BN(params.deadline),
      travelRuleHash: Array.from(travelRuleHash),
    })
    .accountsPartial({
      payer: seller,
      seller,
      buyer,
      config,
      asset,
      titleMint,
      escrowAuthority,
      sellerTitleAta,
      escrowTitleAta: escrowTitleAta.publicKey,
      paymentMint,
      buyerPaymentAta,
      escrowPaymentAta: escrowPaymentAta.publicKey,
      escrow,
      titleTokenProgram: TOKEN_2022_PROGRAM_ID,
      paymentTokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  const latest = await connection.getLatestBlockhash("confirmed");
  built.feePayer = seller;
  built.recentBlockhash = latest.blockhash;
  built.partialSign(escrowTitleAta, escrowPaymentAta);

  await waitForPhantomAccount(seller, "vendedor", params.onStatus);
  status(params.onStatus, "Firma del vendedor en Phantom…");
  const sellerSigned = await phantom.signTransaction(built);
  const wire = sellerSigned.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  status(
    params.onStatus,
    "Listo: compartí el link con el comprador (válido ~1 min).",
  );

  return {
    v: 1,
    txBase64: bytesToBase64(wire),
    buyer: buyer.toBase58(),
    seller: seller.toBase58(),
    transferIdHex: toHex32(transferId),
    escrow: escrow.toBase58(),
    offerTransferId: params.offerTransferId ?? "",
    createdAt: Math.floor(Date.now() / 1000),
    lastValidBlockHeight: latest.lastValidBlockHeight,
  };
}

/**
 * Buyer: open handoff, sign as buyer, send request_transfer.
 */
export async function buyerCompleteDvPPartial(
  payload: DvPHandoffPayload,
  onStatus?: (msg: string) => void,
): Promise<DvPRequestResult> {
  const phantom = getPhantom();
  if (!phantom?.signTransaction) {
    throw new Error("Phantom no expone signTransaction");
  }
  const buyer = new PublicKey(payload.buyer);
  const connection = new Connection(solanaRpcUrl(), "confirmed");

  const height = await connection.getBlockHeight("confirmed");
  if (height > payload.lastValidBlockHeight) {
    throw new Error(
      "El link expiró (blockhash). Pedile al vendedor que pulse otra vez «Aceptar oferta».",
    );
  }

  const tx = Transaction.from(base64ToBytes(payload.txBase64));
  await waitForPhantomAccount(buyer, "comprador", onStatus, 180_000);
  status(onStatus, "Firma del comprador: liberá Lab USD al escrow…");
  const signed = await phantom.signTransaction(tx);

  status(onStatus, "Enviando request_transfer…");
  const signature = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return {
    signature,
    transferIdHex: payload.transferIdHex,
    escrow: payload.escrow,
  };
}

/**
 * Same-device convenience: seller prepare + wait for buyer switch + complete.
 */
export async function requestTransferOnChain(
  params: DvPRequestParams,
): Promise<DvPRequestResult> {
  const handoff = await sellerPrepareDvPPartial(params);
  return buyerCompleteDvPPartial(handoff, params.onStatus);
}
