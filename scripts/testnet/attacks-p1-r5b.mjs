/**
 * Sepolia P1 + R5b attack evidence (Node 22 + ethers).
 * P1: submitInbound twice with same wire → second reverts MessageAlreadyProcessed (or first fails domain/title).
 * R5b: quorum with non-relayer signature → InvalidQuorum; proposeRotateRelayers to remove r3 (execute after 1d).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  getBytes,
  hexlify,
  keccak256,
  toUtf8Bytes,
  AbiCoder,
} from "ethers";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const require = createRequire(resolve(ROOT, "solana/package.json"));
const { PublicKey } = require("@solana/web3.js");

function loadPk(path) {
  return JSON.parse(readFileSync(path, "utf8")).private_key;
}

function writeU64BE(buf, o, v) {
  new DataView(buf.buffer, buf.byteOffset, buf.byteLength).setBigUint64(o, v, false);
}
function writeU32BE(buf, o, v) {
  new DataView(buf.buffer, buf.byteOffset, buf.byteLength).setUint32(o, v, false);
}

const DOMAIN = "LegalTitleBridge.Packet.v1";
function domainTag() {
  return getBytes(keccak256(toUtf8Bytes(DOMAIN)));
}

function buildTransferRequestWire() {
  const prog = new PublicKey("2DvHn2Hxj3HFsbn2iDuBGL4TQAzTomcVCsDTPoZ2h1JL");
  const emitter = Buffer.from(prog.toBytes());
  const payload = new Uint8Array(232);
  payload.set(getBytes("0x" + "11".repeat(32)), 0);
  payload.set(getBytes("0x" + "bb".repeat(32)), 32);
  payload.set(getBytes("0x" + "cc".repeat(32)), 64);
  payload.set(getBytes("0x" + "00".repeat(31) + "0a"), 96);
  payload.set(getBytes("0x" + "22".repeat(32)), 128);
  payload.set(getBytes("0x" + "00".repeat(31) + "01"), 160);
  writeU64BE(payload, 192, BigInt(Math.floor(Date.now() / 1000) + 86400));
  payload.set(getBytes("0x" + "33".repeat(32)), 200);

  const src = 100002n;
  const dst = 11155111n;
  const epoch = 1n;
  const msgType = 1;
  const wire = new Uint8Array(62 + payload.length);
  wire[0] = 1;
  writeU64BE(wire, 1, src);
  writeU64BE(wire, 9, dst);
  wire.set(emitter, 17);
  writeU64BE(wire, 49, epoch);
  wire[57] = msgType;
  writeU32BE(wire, 58, payload.length);
  wire.set(payload, 62);

  const mid = getBytes(keccak256(wire));
  const buf = new Uint8Array(121);
  buf.set(domainTag(), 0);
  buf[32] = 1;
  writeU64BE(buf, 33, src);
  writeU64BE(buf, 41, dst);
  buf.set(emitter, 49);
  writeU64BE(buf, 81, epoch);
  buf.set(mid, 89);
  const digest = getBytes(keccak256(buf));
  return { wire, mid, digest };
}

function sortSigs(wallets, digest) {
  const pairs = wallets.map((w) => ({
    addr: w.address.toLowerCase(),
    sig: w.signingKey.sign(digest).serialized,
  }));
  pairs.sort((a, b) => (a.addr < b.addr ? -1 : 1));
  return pairs.map((p) => p.sig);
}

const ENDPOINT = "0x577f3B58DF21357ED4F8AF6631d2017FAeE38389";
const ABI = [
  "function submitInbound(bytes wire, bytes[] signatures)",
  "function proposeRotateRelayers(address[] newSet, uint256 newThreshold)",
  "function processed(bytes32 messageId) view returns (bool)",
  "error MessageAlreadyProcessed(bytes32 messageId)",
  "error InvalidQuorum()",
];

async function main() {
  mkdirSync(resolve(ROOT, "secrets/deploy"), { recursive: true });
  const rpc = process.env.SEPOLIA_RPC_URL;
  if (!rpc) throw new Error("SEPOLIA_RPC_URL required");
  const provider = new JsonRpcProvider(rpc);
  const deployer = new Wallet(loadPk(resolve(ROOT, "secrets/roles/deployer.json")), provider);
  const admin = new Wallet(loadPk(resolve(ROOT, "secrets/roles/admin.json")), provider);
  const r1 = new Wallet(loadPk(resolve(ROOT, "secrets/relayers/1.json")), provider);
  const r2 = new Wallet(loadPk(resolve(ROOT, "secrets/relayers/2.json")), provider);
  const r3 = new Wallet(loadPk(resolve(ROOT, "secrets/relayers/3.json")), provider);

  const ep = new Contract(ENDPOINT, ABI, deployer);
  const { wire, mid, digest } = buildTransferRequestWire();
  const wireHex = hexlify(wire);
  const midHex = hexlify(mid);
  console.log("messageId", midHex);

  const fee = { maxFeePerGas: 50_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n, gasLimit: 3_000_000n };
  const report = { messageId: midHex, p1: {}, r5b: {} };

  const sigsOk = sortSigs([r1, r2], digest);
  console.log("[P1] first submitInbound");
  try {
    const tx = await ep.submitInbound(wireHex, sigsOk, fee);
    const rc = await tx.wait();
    report.p1.first = { hash: rc.hash, status: rc.status };
    console.log("first", rc.hash, "status", rc.status);
  } catch (e) {
    report.p1.first = { error: String(e.shortMessage || e.message || e).slice(0, 300) };
    console.log("first reverted (may be OK if title rejects):", report.p1.first.error);
  }

  console.log("[P1] replay submitInbound");
  try {
    const tx = await ep.submitInbound(wireHex, sigsOk, fee);
    const rc = await tx.wait();
    report.p1.replay = { hash: rc.hash, status: rc.status, unexpectedSuccess: true };
  } catch (e) {
    report.p1.replay = {
      rejected: true,
      error: String(e.shortMessage || e.message || e).slice(0, 400),
    };
    console.log("replay rejected:", report.p1.replay.error);
  }

  const processed = await ep.processed(midHex);
  report.p1.processed = processed;
  console.log("processed=", processed);

  console.log("[R5b] 1 valid + 1 non-relayer");
  const sigsBad = sortSigs([r1, deployer], digest);
  try {
    const tx = await ep.submitInbound(wireHex, sigsBad, fee);
    const rc = await tx.wait();
    report.r5b.badSig = { hash: rc.hash, status: rc.status, unexpectedSuccess: true };
  } catch (e) {
    report.r5b.badSig = {
      rejected: true,
      error: String(e.shortMessage || e.message || e).slice(0, 400),
    };
    console.log("badSig rejected:", report.r5b.badSig.error);
  }

  console.log("[R5b] proposeRotateRelayers (r3 → deployer); execute after 1 day");
  const epAdmin = ep.connect(admin);
  try {
    const tx = await epAdmin.proposeRotateRelayers(
      [r1.address, r2.address, deployer.address],
      2,
      { ...fee, gasLimit: 500_000n },
    );
    const rc = await tx.wait();
    report.r5b.proposeRotate = { hash: rc.hash, status: rc.status };
    console.log("proposeRotate", rc.hash, rc.status);
  } catch (e) {
    report.r5b.proposeRotate = { error: String(e.shortMessage || e.message || e).slice(0, 300) };
    console.log("proposeRotate:", report.r5b.proposeRotate.error);
  }

  const out = resolve(ROOT, "secrets/deploy/attacks-eth.json");
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.log("wrote", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
