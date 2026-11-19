/**
 * SQLite message store — unique messageId, idempotent insert, exponential retries.
 * Uses Node 22 `node:sqlite` (DatabaseSync).
 */

import { DatabaseSync } from 'node:sqlite';

import type { InsertMessageInput, MessageStatus, StoredMessage } from './types.ts';

const DEFAULT_BASE_MS = 1_000;
const DEFAULT_CAP_MS = 60_000;

export interface StoreOptions {
  /** Path or `:memory:`. */
  path?: string;
  baseRetryMs?: number;
  capRetryMs?: number;
  now?: () => number;
}

export class MessageStore {
  readonly db: DatabaseSync;
  private readonly baseRetryMs: number;
  private readonly capRetryMs: number;
  private readonly now: () => number;

  constructor(options: StoreOptions = {}) {
    this.db = new DatabaseSync(options.path ?? ':memory:');
    this.baseRetryMs = options.baseRetryMs ?? DEFAULT_BASE_MS;
    this.capRetryMs = options.capRetryMs ?? DEFAULT_CAP_MS;
    this.now = options.now ?? Date.now;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        message_id TEXT PRIMARY KEY NOT NULL,
        direction TEXT NOT NULL,
        msg_type INTEGER NOT NULL,
        wire BLOB NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_retry_at INTEGER,
        last_error TEXT,
        signatures TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
    `);
  }

  close(): void {
    this.db.close();
  }

  /**
   * Insert a message once. Returns true if inserted, false if messageId already existed (I3 / F1).
   */
  insertIdempotent(input: InsertMessageInput): boolean {
    const ts = this.now();
    const status = input.status ?? 'seen';
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO messages
          (message_id, direction, msg_type, wire, status, attempts, next_retry_at, last_error, signatures, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, NULL, NULL, '[]', ?, ?)`
      )
      .run(
        input.messageId,
        input.direction,
        input.msgType,
        input.wire,
        status,
        ts,
        ts
      );
    return Number(result.changes) === 1;
  }

  get(messageId: string): StoredMessage | null {
    const row = this.db
      .prepare(`SELECT * FROM messages WHERE message_id = ?`)
      .get(messageId) as Record<string, unknown> | undefined;
    return row ? rowToMessage(row) : null;
  }

  list(limit = 100): StoredMessage[] {
    const rows = this.db
      .prepare(`SELECT * FROM messages ORDER BY created_at ASC LIMIT ?`)
      .all(limit) as Record<string, unknown>[];
    return rows.map(rowToMessage);
  }

  updateStatus(messageId: string, status: MessageStatus): void {
    const ts = this.now();
    this.db
      .prepare(`UPDATE messages SET status = ?, updated_at = ? WHERE message_id = ?`)
      .run(status, ts, messageId);
  }

  addSignature(messageId: string, signatureHex: string): StoredMessage | null {
    const msg = this.get(messageId);
    if (!msg) return null;
    if (!msg.signatures.includes(signatureHex)) {
      msg.signatures.push(signatureHex);
    }
    const ts = this.now();
    this.db
      .prepare(`UPDATE messages SET signatures = ?, status = ?, updated_at = ? WHERE message_id = ?`)
      .run(JSON.stringify(msg.signatures), msg.status === 'seen' || msg.status === 'finalized' ? 'signed' : msg.status, ts, messageId);
    return this.get(messageId);
  }

  /**
   * Record a failed delivery attempt and schedule exponential backoff.
   * next = now + min(cap, base * 2^attempts)
   */
  markRetry(messageId: string, error: string): StoredMessage | null {
    const msg = this.get(messageId);
    if (!msg) return null;
    const attempts = msg.attempts + 1;
    const delay = Math.min(this.capRetryMs, this.baseRetryMs * 2 ** Math.min(attempts - 1, 16));
    const next = this.now() + delay;
    const ts = this.now();
    this.db
      .prepare(
        `UPDATE messages SET attempts = ?, next_retry_at = ?, last_error = ?, status = ?, updated_at = ?
         WHERE message_id = ?`
      )
      .run(attempts, next, error, 'failed', ts, messageId);
    return this.get(messageId);
  }

  /** Messages ready to retry (failed + next_retry_at <= now). */
  dueForRetry(limit = 50): StoredMessage[] {
    const ts = this.now();
    const rows = this.db
      .prepare(
        `SELECT * FROM messages
         WHERE status = 'failed' AND next_retry_at IS NOT NULL AND next_retry_at <= ?
         ORDER BY next_retry_at ASC LIMIT ?`
      )
      .all(ts, limit) as Record<string, unknown>[];
    return rows.map(rowToMessage);
  }

  count(): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS c FROM messages`).get() as { c: number };
    return Number(row.c);
  }
}

function rowToMessage(row: Record<string, unknown>): StoredMessage {
  const wireRaw = row['wire'];
  let wire: Uint8Array;
  if (wireRaw instanceof Uint8Array) {
    wire = wireRaw;
  } else if (Buffer.isBuffer(wireRaw)) {
    wire = new Uint8Array(wireRaw);
  } else if (typeof wireRaw === 'string') {
    wire = Uint8Array.from(Buffer.from(wireRaw, 'binary'));
  } else {
    wire = new Uint8Array(0);
  }

  const sigRaw = row['signatures'];
  const signatures: string[] =
    typeof sigRaw === 'string' ? (JSON.parse(sigRaw) as string[]) : [];

  return {
    messageId: String(row['message_id']),
    direction: row['direction'] as StoredMessage['direction'],
    msgType: Number(row['msg_type']),
    wire,
    status: row['status'] as StoredMessage['status'],
    attempts: Number(row['attempts']),
    nextRetryAt: row['next_retry_at'] == null ? null : Number(row['next_retry_at']),
    lastError: row['last_error'] == null ? null : String(row['last_error']),
    signatures,
    createdAt: Number(row['created_at']),
    updatedAt: Number(row['updated_at']),
  };
}

/** Pure helper exported for unit tests of backoff math. */
export function nextRetryDelayMs(attempts: number, baseMs = DEFAULT_BASE_MS, capMs = DEFAULT_CAP_MS): number {
  const a = Math.max(1, attempts);
  return Math.min(capMs, baseMs * 2 ** Math.min(a - 1, 16));
}
