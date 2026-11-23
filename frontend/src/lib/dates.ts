/**
 * Date helpers for human expiry fields ↔ unix seconds (on-chain uint64).
 */

/** Local calendar date `YYYY-MM-DD` → unix seconds at end of that UTC day. */
export function dateInputToUnixExpiry(dateYmd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd.trim());
  if (!m) throw new Error(`invalid date: ${dateYmd}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // End of day UTC so the assertion stays valid through that calendar date.
  return Math.floor(Date.UTC(y, mo - 1, d, 23, 59, 59) / 1000);
}

/** Default expiry: one year from today as `YYYY-MM-DD`. */
export function defaultExpiryDateInput(now = new Date()): string {
  const y = now.getUTCFullYear() + 1;
  const mo = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}
