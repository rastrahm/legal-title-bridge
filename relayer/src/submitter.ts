/**
 * Quorum collector + delivery — anyone may submit once signatures meet threshold.
 */

import type { MessageStore } from './store.ts';
import type { RelayerSigner } from './signer.ts';
import type { StoredMessage } from './types.ts';

export interface DeliveryTransport {
  /** Deliver wire + signatures to the destination chain. */
  deliver(msg: StoredMessage, signatures: string[]): Promise<void>;
}

export interface SubmitterOptions {
  store: MessageStore;
  signer: RelayerSigner;
  transport: DeliveryTransport;
  threshold: number;
  /** Produce the 32-byte signing digest for a stored message. */
  digestOf: (msg: StoredMessage) => Uint8Array;
}

export class Submitter {
  constructor(private readonly opts: SubmitterOptions) {}

  /** Sign locally and persist signature; mark quorum_ready when threshold met. */
  signLocal(messageId: string): StoredMessage | null {
    const msg = this.opts.store.get(messageId);
    if (!msg) return null;
    const digest = this.opts.digestOf(msg);
    const sig = this.opts.signer.signDigest(digest);
    const updated = this.opts.store.addSignature(messageId, sig);
    if (!updated) return null;
    if (updated.signatures.length >= this.opts.threshold) {
      this.opts.store.updateStatus(messageId, 'quorum_ready');
      return this.opts.store.get(messageId);
    }
    return updated;
  }

  /** Import a peer signature (signature exchange between relayer processes). */
  importSignature(messageId: string, signatureHex: string): StoredMessage | null {
    const updated = this.opts.store.addSignature(messageId, signatureHex);
    if (!updated) return null;
    if (updated.signatures.length >= this.opts.threshold) {
      this.opts.store.updateStatus(messageId, 'quorum_ready');
      return this.opts.store.get(messageId);
    }
    return updated;
  }

  /**
   * Submit if quorum_ready. On success → delivered; on failure → exponential retry.
   * Permissionless: any process with the signatures may call this.
   */
  async tryDeliver(messageId: string): Promise<'delivered' | 'skipped' | 'retry'> {
    const msg = this.opts.store.get(messageId);
    if (!msg) return 'skipped';
    if (msg.status === 'delivered') return 'skipped';
    if (msg.signatures.length < this.opts.threshold && msg.status !== 'quorum_ready') {
      return 'skipped';
    }

    this.opts.store.updateStatus(messageId, 'submitted');
    try {
      await this.opts.transport.deliver(msg, msg.signatures);
      this.opts.store.updateStatus(messageId, 'delivered');
      return 'delivered';
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : String(err);
      this.opts.store.markRetry(messageId, text);
      return 'retry';
    }
  }
}
