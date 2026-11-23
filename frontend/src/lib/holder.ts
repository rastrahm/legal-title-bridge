/**
 * D2: holders on Ethereum are Solana pubkeys as bytes32.
 * Lab stubs (e.g. "seller-sol") get a stable keccak id so the UI still works.
 */

import { hexlify, keccak256, toUtf8Bytes } from "ethers";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Decode a Solana base58 address to 32 raw bytes.
 * @throws if alphabet invalid or decoded length ≠ 32
 */
export function decodeSolanaPubkey(address: string): Uint8Array {
  let num = 0n;
  for (const ch of address) {
    const idx = BASE58_ALPHABET.indexOf(ch);
    if (idx < 0) {
      throw new Error(`invalid base58 character: ${ch}`);
    }
    num = num * 58n + BigInt(idx);
  }

  const body: number[] = [];
  while (num > 0n) {
    body.unshift(Number(num % 256n));
    num /= 256n;
  }

  let leadingZeros = 0;
  for (const ch of address) {
    if (ch !== "1") break;
    leadingZeros++;
  }

  const out = new Uint8Array(leadingZeros + body.length);
  out.set(body, leadingZeros);
  if (out.length !== 32) {
    throw new Error(`expected 32-byte pubkey, got ${out.length}`);
  }
  return out;
}

/**
 * Map a Solana address (or lab stub) to the IdentityRegistry holder bytes32 hex.
 */
export function holderIdFromSolanaAddress(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) {
    throw new Error("empty solana address");
  }
  try {
    const bytes = decodeSolanaPubkey(trimmed);
    return hexlify(bytes);
  } catch {
    return keccak256(toUtf8Bytes(`ltb-holder:${trimmed}`));
  }
}
