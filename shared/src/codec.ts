import { keccak256, getBytes, hexlify, toUtf8Bytes } from 'ethers';

/** Canonical LTB packet codec — must match PacketCodec.sol and codec.rs (C5). */

export const PACKET_VERSION = 1;
export const HEADER_SIZE = 62;
export const DOMAIN_TAG_STRING = 'LegalTitleBridge.Packet.v1';

export enum MsgType {
  ISSUE = 0,
  TRANSFER_REQUEST = 1,
  TRANSFER_DECISION = 2,
  FORCED_TRANSFER = 3,
}

export type Packet = {
  version: number;
  srcChain: bigint;
  dstChain: bigint;
  emitter: Uint8Array; // 32 bytes
  epoch: bigint;
  msgType: MsgType;
  payload: Uint8Array;
};

export function domainTag(): Uint8Array {
  return getBytes(keccak256(toUtf8Bytes(DOMAIN_TAG_STRING)));
}

function writeU64BE(buf: Uint8Array, offset: number, value: bigint): void {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setBigUint64(offset, value, false);
}

function readU64BE(buf: Uint8Array, offset: number): bigint {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return view.getBigUint64(offset, false);
}

function writeU32BE(buf: Uint8Array, offset: number, value: number): void {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setUint32(offset, value, false);
}

function readU32BE(buf: Uint8Array, offset: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return view.getUint32(offset, false);
}

export function encode(packet: Packet): Uint8Array {
  if (packet.version !== PACKET_VERSION) {
    throw new Error(`UnsupportedVersion(${packet.version})`);
  }
  if (packet.msgType < 0 || packet.msgType > MsgType.FORCED_TRANSFER) {
    throw new Error(`UnsupportedMsgType(${packet.msgType})`);
  }
  if (packet.emitter.length !== 32) {
    throw new Error('InvalidPacket: emitter must be 32 bytes');
  }
  if (packet.payload.length > 0xffffffff) {
    throw new Error('InvalidPacket: payload too large');
  }

  const data = new Uint8Array(HEADER_SIZE + packet.payload.length);
  data[0] = packet.version;
  writeU64BE(data, 1, packet.srcChain);
  writeU64BE(data, 9, packet.dstChain);
  data.set(packet.emitter, 17);
  writeU64BE(data, 49, packet.epoch);
  data[57] = packet.msgType;
  writeU32BE(data, 58, packet.payload.length);
  data.set(packet.payload, 62);
  return data;
}

export function decode(data: Uint8Array): Packet {
  if (data.length < HEADER_SIZE) {
    throw new Error('InvalidPacket: too short');
  }
  // Length already ≥ HEADER_SIZE — indices 0 and 57 are in range.
  const version = data[0]!;
  if (version !== PACKET_VERSION) {
    throw new Error(`UnsupportedVersion(${version})`);
  }
  const msgTypeRaw = data[57]!;
  if (msgTypeRaw > MsgType.FORCED_TRANSFER) {
    throw new Error(`UnsupportedMsgType(${msgTypeRaw})`);
  }
  const payloadLen = readU32BE(data, 58);
  if (data.length !== HEADER_SIZE + payloadLen) {
    throw new Error('InvalidPacket: length mismatch');
  }
  return {
    version,
    srcChain: readU64BE(data, 1),
    dstChain: readU64BE(data, 9),
    emitter: data.slice(17, 49),
    epoch: readU64BE(data, 49),
    msgType: msgTypeRaw as MsgType,
    payload: data.slice(62),
  };
}

export function messageIdOfWire(wire: Uint8Array): Uint8Array {
  return getBytes(keccak256(wire));
}

export function messageId(packet: Packet): Uint8Array {
  return messageIdOfWire(encode(packet));
}

export function signingDigest(packet: Packet): Uint8Array {
  const mid = messageId(packet);
  return signingDigestFromParts(
    packet.version,
    packet.srcChain,
    packet.dstChain,
    packet.emitter,
    packet.epoch,
    mid,
  );
}

export function signingDigestFromParts(
  version: number,
  srcChain: bigint,
  dstChain: bigint,
  emitter: Uint8Array,
  epoch: bigint,
  mid: Uint8Array,
): Uint8Array {
  const buf = new Uint8Array(121);
  buf.set(domainTag(), 0);
  buf[32] = version;
  writeU64BE(buf, 33, srcChain);
  writeU64BE(buf, 41, dstChain);
  buf.set(emitter, 49);
  writeU64BE(buf, 81, epoch);
  buf.set(mid, 89);
  return getBytes(keccak256(buf));
}

export function toHex(bytes: Uint8Array): string {
  return hexlify(bytes);
}

export function fromHex(hex: string): Uint8Array {
  return getBytes(hex);
}
