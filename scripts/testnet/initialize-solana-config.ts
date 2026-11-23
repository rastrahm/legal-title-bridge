/**
 * Initialize title_mirror Config PDA on Devnet after Sepolia BridgeEndpoint is known.
 *
 * Usage (Node 22):
 *   ETH_ENDPOINT=0x... RELAYER1=0x... RELAYER2=0x... RELAYER3=0x... \
 *   npx tsx scripts/testnet/initialize-solana-config.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const SOLANA = resolve(ROOT, "solana");

function ethAddressToBytes32(addr: string): number[] {
  const hex = addr.replace(/^0x/i, "").toLowerCase();
  if (hex.length !== 40) throw new Error(`bad eth address: ${addr}`);
  const buf = Buffer.alloc(32);
  Buffer.from(hex, "hex").copy(buf, 12);
  return Array.from(buf);
}

function ethAddressTo20(addr: string): number[] {
  const hex = addr.replace(/^0x/i, "").toLowerCase();
  if (hex.length !== 40) throw new Error(`bad eth address: ${addr}`);
  return Array.from(Buffer.from(hex, "hex"));
}

async function main() {
  const ethEndpoint = process.env.ETH_ENDPOINT;
  const r1 = process.env.RELAYER1;
  const r2 = process.env.RELAYER2;
  const r3 = process.env.RELAYER3;
  if (!ethEndpoint || !r1 || !r2 || !r3) {
    throw new Error("ETH_ENDPOINT RELAYER1 RELAYER2 RELAYER3 required");
  }

  process.chdir(SOLANA);
  const idl = JSON.parse(readFileSync(resolve(SOLANA, "target/idl/title_mirror.json"), "utf8"));
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new Program(idl, provider) as Program;
  const admin = (provider.wallet as anchor.Wallet).payer;
  const CONFIG_SEED = Buffer.from("config");
  const [configPda] = PublicKey.findProgramAddressSync([CONFIG_SEED], program.programId);

  const localChainId = new anchor.BN(100_002); // Solana Devnet
  const remoteChainId = new anchor.BN(11_155_111); // Sepolia
  const hardDeadlineSecs = new anchor.BN(7 * 24 * 60 * 60);

  const sig = await program.methods
    .initializeConfig({
      ethEndpoint: ethAddressToBytes32(ethEndpoint),
      localChainId,
      remoteChainId,
      threshold: 2,
      relayers: [ethAddressTo20(r1), ethAddressTo20(r2), ethAddressTo20(r3)],
      hardDeadlineSecs,
    })
    .accountsPartial({
      admin: admin.publicKey,
      config: configPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("initialize_config signature:", sig);
  console.log("config PDA:", configPda.toBase58());
  const cfg = await (program.account as any).config.fetch(configPda);
  console.log("epoch:", cfg.epoch.toString(), "threshold:", cfg.threshold);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
