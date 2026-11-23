import { beforeEach, describe, expect, it } from "vitest";

import {
  DEMO_MARKET_STORAGE_KEY,
  loadPersistedMarket,
  savePersistedMarket,
} from "./persist";
import { createDemoState } from "./store";

describe("demo market persist", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("returns null when storage is empty or invalid", () => {
    expect(loadPersistedMarket()).toBeNull();
    window.sessionStorage.setItem(DEMO_MARKET_STORAGE_KEY, "{");
    expect(loadPersistedMarket()).toBeNull();
    window.sessionStorage.setItem(
      DEMO_MARKET_STORAGE_KEY,
      JSON.stringify({ v: 1, listings: "nope" }),
    );
    expect(loadPersistedMarket()).toBeNull();
  });

  it("round-trips listings and requests", () => {
    const base = createDemoState();
    const listings = [
      {
        listingId: "listing:abc",
        assetId: base.listings[0]!.assetId,
        assetName: "Lote",
        seller: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        titleAmount: "7",
        priceLabel: "7 Lab USD",
        paymentAmount: "7",
        status: "Open" as const,
      },
      ...base.listings,
    ];
    const requests = base.requests;
    savePersistedMarket({ listings, requests });

    const loaded = loadPersistedMarket();
    expect(loaded).not.toBeNull();
    expect(loaded!.listings).toEqual(listings);
    expect(loaded!.requests).toEqual(requests);
    expect(window.sessionStorage.getItem(DEMO_MARKET_STORAGE_KEY)).toContain(
      "listing:abc",
    );
  });
});
