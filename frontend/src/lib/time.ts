/**
 * Clock helpers for event handlers (kept out of render paths for react-hooks/purity).
 */

/** Unix seconds (UTC). */
export function unixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Hex id suffix from wall clock (lab / UI keys only). */
export function hexTimeSuffix(): string {
  return Date.now().toString(16);
}
