/**
 * Relayer secp256k1 signer — signs the bridge signingDigest (D11), no EIP-191 prefix.
 */

import { SigningKey, computeAddress, getBytes, hexlify } from 'ethers';

export class RelayerSigner {
  readonly address: string;
  private readonly key: SigningKey;

  constructor(privateKeyHex: string) {
    this.key = new SigningKey(privateKeyHex);
    this.address = computeAddress(this.key.publicKey);
  }

  /** Sign a 32-byte digest; returns 65-byte hex signature (r||s||v). */
  signDigest(digest: Uint8Array | string): string {
    const bytes = typeof digest === 'string' ? getBytes(digest) : digest;
    if (bytes.length !== 32) {
      throw new Error(`digest must be 32 bytes, got ${bytes.length}`);
    }
    const sig = this.key.sign(bytes);
    return hexlify(sig.serialized);
  }
}
