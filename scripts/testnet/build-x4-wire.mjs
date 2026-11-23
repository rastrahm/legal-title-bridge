/**
 * Build epoch-1 TRANSFER_REQUEST wire + digest for X4 (run from repo with NODE_PATH=relayer/node_modules).
 */
import { createRequire } from "module";
import { getBytes, hexlify, keccak256, toUtf8Bytes } from "ethers";

const require = createRequire(new URL("../../solana/package.json", import.meta.url));
const { PublicKey } = require("@solana/web3.js");

const PACKET_VERSION = 1;
const HEADER = 62;
const DOMAIN = "LegalTitleBridge.Packet.v1";

function writeU64BE(buf, o, v) {
  new DataView(buf.buffer, buf.byteOffset, buf.byteLength).setBigUint64(o, v, false);
}
function writeU32BE(buf, o, v) {
  new DataView(buf.buffer, buf.byteOffset, buf.byteLength).setUint32(o, v, false);
}
function domainTag() {
  return getBytes(keccak256(toUtf8Bytes(DOMAIN)));
}

const prog = new PublicKey("2DvHn2Hxj3HFsbn2iDuBGL4TQAzTomcVCsDTPoZ2h1JL");
const emitter = Buffer.from(prog.toBytes());
const payload = new Uint8Array(232);
payload.set(getBytes("0x" + "44".repeat(32)), 0);
payload.set(getBytes("0x" + "bb".repeat(32)), 32);
payload.set(getBytes("0x" + "cc".repeat(32)), 64);
payload.set(getBytes("0x" + "00".repeat(31) + "0a"), 96);
payload.set(getBytes("0x" + "22".repeat(32)), 128);
payload.set(getBytes("0x" + "00".repeat(31) + "01"), 160);
writeU64BE(payload, 192, BigInt(Math.floor(Date.now() / 1000) + 86400));
payload.set(getBytes("0x" + "33".repeat(32)), 200);

const src = 100002n;
const dst = 11155111n;
const epoch = 1n; // OLD epoch for X4
const msgType = 1;
const wire = new Uint8Array(HEADER + payload.length);
wire[0] = PACKET_VERSION;
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
buf[32] = PACKET_VERSION;
writeU64BE(buf, 33, src);
writeU64BE(buf, 41, dst);
buf.set(emitter, 49);
writeU64BE(buf, 81, epoch);
buf.set(mid, 89);
const digest = getBytes(keccak256(buf));
process.stdout.write(
  JSON.stringify({ wire: hexlify(wire), mid: hexlify(mid), digest: hexlify(digest) }),
);
