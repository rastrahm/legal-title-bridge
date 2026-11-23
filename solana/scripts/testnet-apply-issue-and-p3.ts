/**
 * TESTNET Devnet: initialize_asset → P3 (stranger path reject) → apply_issue with relayer quorum.
 *
 * Requires ANCHOR_PROVIDER_URL=https://api.devnet.solana.com and ANCHOR_WALLET.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  Secp256k1Program,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { createHash } from "crypto";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { getBytes, hexlify, keccak256, SigningKey, computeAddress } from "ethers";

const ROOT = resolve(__dirname, "../..");
const OUT = resolve(ROOT, "secrets/deploy/devnet-apply-p3.json");

const CONFIG_SEED = Buffer.from("config");
const ASSET_SEED = Buffer.from("asset");
const PERMANENT_DELEGATE_SEED = Buffer.from("permanent_delegate");
const ESCROW_AUTHORITY_SEED = Buffer.from("escrow_authority");
const PROCESSED_SEED = Buffer.from("processed");

const WIRE_HEX = readFileSync(resolve(ROOT, "secrets/deploy/issue-wire.hex"), "utf8").trim();
const ASSET_ID = getBytes(
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
);

function loadRelayerPk(n: number): Uint8Array {
  const hex = JSON.parse(
    readFileSync(resolve(ROOT, `secrets/relayers/${n}.json`), "utf8"),
  ).private_key as string;
  return getBytes(hex);
}

function writeU64BE(buf: Uint8Array, o: number, v: bigint) {
  new DataView(buf.buffer, buf.byteOffset, buf.byteLength).setBigUint64(o, v, false);
}

/** Reconstruct 121-byte signing preimage from wire (must match PacketCodec.signingDigest). */
function signingPreimageFromWire(wire: Uint8Array): Uint8Array {
  const DOMAIN = "LegalTitleBridge.Packet.v1";
  const tag = getBytes(keccak256(Buffer.from(DOMAIN, "utf8")));
  const mid = getBytes(keccak256(wire));
  const view = new DataView(wire.buffer, wire.byteOffset, wire.byteLength);
  const src = view.getBigUint64(1, false);
  const dst = view.getBigUint64(9, false);
  const emitter = wire.slice(17, 49);
  const epoch = view.getBigUint64(49, false);
  const version = wire[0]!;
  const buf = new Uint8Array(121);
  buf.set(tag, 0);
  buf[32] = version;
  writeU64BE(buf, 33, src);
  writeU64BE(buf, 41, dst);
  buf.set(emitter, 49);
  writeU64BE(buf, 81, epoch);
  buf.set(mid, 89);
  return buf;
}

function asAnchorBytes(data: Uint8Array): Buffer {
  return Buffer.from(data) as Buffer;
}

async function main() {
  mkdirSync(resolve(ROOT, "secrets/deploy"), { recursive: true });
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const idl = JSON.parse(
    readFileSync(resolve(__dirname, "../target/idl/title_mirror.json"), "utf8"),
  );
  const program = new Program(idl, provider) as Program;
  const admin = (provider.wallet as anchor.Wallet).payer;
  const report: Record<string, unknown> = { programId: program.programId.toBase58() };

  const configPda = PublicKey.findProgramAddressSync([CONFIG_SEED], program.programId)[0];
  const assetIdBuf = Buffer.from(ASSET_ID);
  const assetPda = PublicKey.findProgramAddressSync(
    [ASSET_SEED, assetIdBuf],
    program.programId,
  )[0];

  // --- initialize_asset (or reuse if exists) ---
  let mint: PublicKey;
  let permanentDelegate: PublicKey;
  let escrowAuthority: PublicKey;
  try {
    const existing = await (program.account as any).asset.fetch(assetPda);
    mint = existing.mint as PublicKey;
    permanentDelegate = existing.permanentDelegate as PublicKey;
    const [ea] = PublicKey.findProgramAddressSync(
      [ESCROW_AUTHORITY_SEED, mint.toBuffer()],
      program.programId,
    );
    escrowAuthority = ea;
    report.initializeAsset = { reused: true, mint: mint.toBase58() };
    console.log("asset exists, mint", mint.toBase58());
  } catch {
    const mintKp = Keypair.generate();
    mint = mintKp.publicKey;
    [permanentDelegate] = PublicKey.findProgramAddressSync(
      [PERMANENT_DELEGATE_SEED, mint.toBuffer()],
      program.programId,
    );
    [escrowAuthority] = PublicKey.findProgramAddressSync(
      [ESCROW_AUTHORITY_SEED, mint.toBuffer()],
      program.programId,
    );
    const sig = await program.methods
      .initializeAsset(Array.from(ASSET_ID), 0)
      .accountsPartial({
        admin: admin.publicKey,
        config: configPda,
        permanentDelegate,
        escrowAuthority,
        mint,
        asset: assetPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([mintKp])
      .rpc();
    report.initializeAsset = { signature: sig, mint: mint.toBase58() };
    console.log("initialize_asset", sig);
    // Wait until mint is visible (Devnet RPC lag after init).
    for (let i = 0; i < 20; i++) {
      const info = await provider.connection.getAccountInfo(mint, "confirmed");
      if (info && info.data.length >= 82) break;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Re-fetch PDAs from on-chain asset (source of truth after init/reuse).
  {
    const onchain = await (program.account as any).asset.fetch(assetPda);
    mint = onchain.mint as PublicKey;
    permanentDelegate = onchain.permanentDelegate as PublicKey;
    [escrowAuthority] = PublicKey.findProgramAddressSync(
      [ESCROW_AUTHORITY_SEED, mint.toBuffer()],
      program.programId,
    );
  }

  // --- P3: stranger transfer path must fail ---
  const stranger = Keypair.generate().publicKey;
  try {
    await program.methods
      .assertTransferPath()
      .accountsPartial({
        authority: stranger,
        mint,
        asset: assetPda,
        permanentDelegate,
        escrowAuthority,
      })
      .rpc();
    report.p3 = { rejected: false, unexpectedSuccess: true };
    console.error("P3 UNEXPECTED SUCCESS");
  } catch (e: any) {
    const msg = String(e);
    const logs = Array.isArray(e?.logs) ? e.logs.join("\n") : "";
    report.p3 = {
      rejected: /UnauthorizedTransferPath/i.test(msg + logs),
      error: msg.slice(0, 200),
    };
    console.log("P3 rejected:", report.p3);
  }

  // permanent delegate path should succeed (control)
  try {
    await program.methods
      .assertTransferPath()
      .accountsPartial({
        authority: permanentDelegate,
        mint,
        asset: assetPda,
        permanentDelegate,
        escrowAuthority,
      })
      .rpc();
    report.p3ControlDelegateOk = true;
  } catch (e: any) {
    report.p3ControlDelegateOk = false;
    report.p3ControlError = String(e).slice(0, 300);
    console.error("P3 control failed", report.p3ControlError);
  }

  // --- ATA for destination (admin wallet as Token-2022 holder of mirrored title) ---
  const dest = getAssociatedTokenAddressSync(
    mint,
    admin.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  const destInfo = await provider.connection.getAccountInfo(dest);
  if (!destInfo) {
    const ix = createAssociatedTokenAccountInstruction(
      admin.publicKey,
      dest,
      admin.publicKey,
      mint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    await provider.sendAndConfirm(new Transaction().add(ix));
  }

  // --- apply_issue with 2 secp256k1 ixs ---
  const wire = getBytes(WIRE_HEX);
  const messageId = getBytes(keccak256(wire));
  const preimage = signingPreimageFromWire(wire);
  const digest = getBytes(keccak256(preimage));
  console.log("digest", hexlify(digest));
  console.log("messageId", hexlify(messageId));

  // Verify Eth-style sign recovers to relayer
  const r1 = loadRelayerPk(1);
  const r2 = loadRelayerPk(2);
  console.log("r1", computeAddress(new SigningKey(hexlify(r1)).publicKey));
  console.log("r2", computeAddress(new SigningKey(hexlify(r2)).publicKey));

  const processed = PublicKey.findProgramAddressSync(
    [PROCESSED_SEED, Buffer.from(messageId)],
    program.programId,
  )[0];

  // instructionIndex: secp ixs at 0 and 1, apply_issue at 2
  const secp1 = Secp256k1Program.createInstructionWithPrivateKey({
    privateKey: Buffer.from(r1),
    message: Buffer.from(preimage),
    instructionIndex: 0,
  });
  const secp2 = Secp256k1Program.createInstructionWithPrivateKey({
    privateKey: Buffer.from(r2),
    message: Buffer.from(preimage),
    instructionIndex: 1,
  });

  const applyIx = await program.methods
    .applyIssue(Array.from(messageId), asAnchorBytes(wire))
    .accountsPartial({
      payer: admin.publicKey,
      config: configPda,
      asset: assetPda,
      mint,
      permanentDelegate,
      destination: dest,
      processed,
      instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const tx = new Transaction().add(secp1, secp2, applyIx);
  try {
    const sig = await sendAndConfirmTransaction(provider.connection, tx, [admin], {
      commitment: "confirmed",
    });
    report.applyIssue = { signature: sig, ok: true };
    console.log("apply_issue", sig);
    const ata = await getAccount(provider.connection, dest, "confirmed", TOKEN_2022_PROGRAM_ID);
    report.applyIssue = { ...report.applyIssue, destinationAmount: ata.amount.toString() };
    console.log("destination amount", ata.amount.toString());
  } catch (e: any) {
    report.applyIssue = { ok: false, error: String(e).slice(0, 500) };
    console.error("apply_issue failed", e);
    // dump simulation logs if present
    if (e?.logs) console.error(e.logs);
  }

  writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
  console.log("wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
