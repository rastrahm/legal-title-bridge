/**
 * Cross-device DvP handoff: seller-signed partial tx → shareable /cartera/firmar#…
 * Lab caveat: Solana blockhash ~60s; buyer must sign before expiry.
 */

export interface DvPHandoffPayload {
  v: 1;
  /** Legacy Transaction serialize({ requireAllSignatures: false }) as base64. */
  txBase64: string;
  buyer: string;
  seller: string;
  transferIdHex: string;
  escrow: string;
  /** UI offer id (demo store transferId). */
  offerTransferId: string;
  createdAt: number;
  lastValidBlockHeight: number;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 =
    typeof btoa === "function"
      ? btoa(bin)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const raw =
    typeof atob === "function"
      ? atob(b64 + pad)
      : Buffer.from(b64 + pad, "base64").toString("binary");
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isPayload(value: unknown): value is DvPHandoffPayload {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    o.v === 1 &&
    typeof o.txBase64 === "string" &&
    typeof o.buyer === "string" &&
    typeof o.seller === "string" &&
    typeof o.transferIdHex === "string" &&
    typeof o.escrow === "string" &&
    typeof o.offerTransferId === "string" &&
    typeof o.createdAt === "number" &&
    typeof o.lastValidBlockHeight === "number"
  );
}

/** Encode handoff for URL hash (UTF-8 JSON → base64url). */
export function encodeDvPHandoff(payload: DvPHandoffPayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

/** Decode hash fragment; null if invalid. */
export function decodeDvPHandoff(encoded: string): DvPHandoffPayload | null {
  try {
    if (!encoded.trim()) return null;
    const bytes = base64UrlToBytes(encoded.trim());
    const json = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(json);
    return isPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Absolute or path href for the buyer firmar page. */
export function buildFirmarHref(
  payload: DvPHandoffPayload,
  origin?: string,
): string {
  const hash = encodeDvPHandoff(payload);
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/cartera/firmar#${hash}`;
}

/** Soft TTL hint (ms) — Solana recent blockhash window. */
export const DVP_HANDOFF_SOFT_TTL_MS = 55_000;
