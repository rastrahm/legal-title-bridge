/**
 * Read-only HTTP API for the frontend bridge monitor (D14 / W6).
 * Only GET /status and GET /messages — all other methods → 405.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { MessageStore } from './store.ts';
import type { ReconcileReport } from './types.ts';

export const STATUS_API_ALLOWED_METHODS = ['GET'] as const;
export type StatusApiAllowedMethod = (typeof STATUS_API_ALLOWED_METHODS)[number];

export function getStatusApiAllowedMethods(): readonly StatusApiAllowedMethod[] {
  return STATUS_API_ALLOWED_METHODS;
}

export interface StatusApiOptions {
  store: MessageStore;
  /** Optional live reconciler snapshot provider. */
  getReconcile?: () => ReconcileReport | null;
  host?: string;
  port?: number;
}

export interface StatusPayload {
  ok: true;
  messageCount: number;
  reconcile: ReconcileReport | null;
  /** Explicit disclaimer for W6 / D14. */
  source: 'relayer';
}

export function createStatusApi(opts: StatusApiOptions): Server {
  const server = createServer((req, res) => {
    void handle(req, res, opts);
  });
  return server;
}

export async function listenStatusApi(opts: StatusApiOptions): Promise<{ server: Server; url: string }> {
  const host = opts.host ?? '127.0.0.1';
  const port = opts.port ?? 0;
  const server = createStatusApi(opts);
  await new Promise<void>((resolve, reject) => {
    server.listen(port, host, () => resolve());
    server.on('error', reject);
  });
  const addr = server.address();
  if (addr == null || typeof addr === 'string') {
    throw new Error('failed to bind status api');
  }
  return { server, url: `http://${host}:${addr.port}` };
}

async function handle(req: IncomingMessage, res: ServerResponse, opts: StatusApiOptions): Promise<void> {
  const method = req.method ?? 'GET';
  if (method !== 'GET') {
    res.writeHead(405, {
      Allow: 'GET',
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify({ error: 'method_not_allowed', allowed: ['GET'] }));
    return;
  }

  const url = new URL(req.url ?? '/', 'http://relayer.local');
  if (url.pathname === '/status') {
    const body: StatusPayload = {
      ok: true,
      messageCount: opts.store.count(),
      reconcile: opts.getReconcile?.() ?? null,
      source: 'relayer',
    };
    json(res, 200, body);
    return;
  }

  if (url.pathname === '/messages') {
    const messages = opts.store.list().map((m) => ({
      messageId: m.messageId,
      direction: m.direction,
      msgType: m.msgType,
      status: m.status,
      attempts: m.attempts,
      signatureCount: m.signatures.length,
      updatedAt: m.updatedAt,
    }));
    json(res, 200, { source: 'relayer', messages });
    return;
  }

  json(res, 404, { error: 'not_found' });
}

function json(res: ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}
