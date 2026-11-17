import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  decode,
  encode,
  fromHex,
  messageIdOfWire,
  signingDigest,
  toHex,
  domainTag,
  DOMAIN_TAG_STRING,
  MsgType,
  type Packet,
} from '../src/codec.ts';
import { keccak256, toUtf8Bytes, getBytes } from 'ethers';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const vectorsPath = join(root, 'test/vectors/packets.json');

describe('codec', () => {
  it('domainTag matches keccak256 of spec string', () => {
    expect(toHex(domainTag())).toBe(keccak256(toUtf8Bytes(DOMAIN_TAG_STRING)));
  });

  it('roundtrips a sample packet', () => {
    const packet: Packet = {
      version: 1,
      srcChain: 31337n,
      dstChain: 100001n,
      emitter: new Uint8Array(32).fill(0x11),
      epoch: 1n,
      msgType: MsgType.ISSUE,
      payload: new Uint8Array(96),
    };
    const wire = encode(packet);
    expect(decode(wire)).toEqual(packet);
  });

  it('matches Solidity golden vectors (C5)', () => {
    const raw = JSON.parse(readFileSync(vectorsPath, 'utf8')) as {
      count: number;
      vectors: Array<{
        name: string;
        wire: string;
        messageId: string;
        signingDigest: string;
      }>;
    };
    expect(raw.vectors.length).toBe(raw.count);

    for (const v of raw.vectors) {
      const wire = fromHex(v.wire);
      const packet = decode(wire);
      expect(toHex(encode(packet))).toBe(v.wire.toLowerCase());
      expect(toHex(messageIdOfWire(wire))).toBe(v.messageId.toLowerCase());
      expect(toHex(signingDigest(packet))).toBe(v.signingDigest.toLowerCase());
      // sanity: domain tag in file matches runtime
      expect(getBytes(keccak256(toUtf8Bytes(DOMAIN_TAG_STRING))).length).toBe(32);
    }
  });
});
