/**
 * Persist Cartera market (listings + offers) across refresh / wallet switch.
 * sessionStorage keeps lab data tab-scoped (no cross-profile leak).
 */

import type { DemoListing, DemoRequest } from "./store";

export const DEMO_MARKET_STORAGE_KEY = "ltb-demo-market-v1";

export interface PersistedMarket {
  listings: DemoListing[];
  requests: DemoRequest[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isListing(value: unknown): value is DemoListing {
  if (!isRecord(value)) return false;
  return (
    typeof value.listingId === "string" &&
    typeof value.assetId === "string" &&
    typeof value.assetName === "string" &&
    typeof value.seller === "string" &&
    typeof value.titleAmount === "string" &&
    typeof value.priceLabel === "string" &&
    typeof value.paymentAmount === "string" &&
    (value.status === "Open" || value.status === "Closed")
  );
}

function isRequest(value: unknown): value is DemoRequest {
  if (!isRecord(value)) return false;
  const status = value.status;
  const okStatus =
    status === "Pending" ||
    status === "Approved" ||
    status === "Rejected" ||
    status === "Expired" ||
    status === "Refunded" ||
    status === "DepositDemo";
  return (
    typeof value.transferId === "string" &&
    typeof value.assetId === "string" &&
    typeof value.seller === "string" &&
    typeof value.buyer === "string" &&
    typeof value.amount === "string" &&
    typeof value.deadline === "number" &&
    typeof value.hardDeadline === "number" &&
    okStatus
  );
}

/**
 * Read market overlay from sessionStorage (browser only).
 */
export function loadPersistedMarket(): PersistedMarket | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DEMO_MARKET_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.v !== 1) return null;
    if (!Array.isArray(parsed.listings) || !Array.isArray(parsed.requests)) {
      return null;
    }
    if (
      !parsed.listings.every(isListing) ||
      !parsed.requests.every(isRequest)
    ) {
      return null;
    }
    return {
      listings: parsed.listings,
      requests: parsed.requests,
    };
  } catch {
    return null;
  }
}

/**
 * Write market overlay (listings + requests) for the current tab.
 */
export function savePersistedMarket(market: PersistedMarket): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      DEMO_MARKET_STORAGE_KEY,
      JSON.stringify({ v: 1, ...market }),
    );
  } catch {
    // Quota / private mode — ignore; UI still works in-memory.
  }
}
