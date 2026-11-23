/**
 * title_mirror PDA helpers (seeds match on-chain state module).
 */

import { PublicKey } from "@solana/web3.js";

import { programId } from "@/lib/solana/config";

const CONFIG_SEED = Buffer.from("config");
const ASSET_SEED = Buffer.from("asset");
const ESCROW_AUTHORITY_SEED = Buffer.from("escrow_authority");
const ESCROW_SEED = Buffer.from("escrow");

export function configPda(program = programId()): PublicKey {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], program)[0];
}

export function assetPda(
  assetId: Uint8Array,
  program = programId(),
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [ASSET_SEED, Buffer.from(assetId)],
    program,
  )[0];
}

export function escrowAuthorityPda(
  titleMint: PublicKey,
  program = programId(),
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [ESCROW_AUTHORITY_SEED, titleMint.toBuffer()],
    program,
  )[0];
}

export function escrowPda(
  transferId: Uint8Array,
  program = programId(),
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [ESCROW_SEED, Buffer.from(transferId)],
    program,
  )[0];
}
