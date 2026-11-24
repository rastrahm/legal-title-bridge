import { describe, expect, it } from "vitest";

import type { DemoListing, DemoState } from "@/lib/demo/store";
import { DEMO_ASSET_ID } from "@/lib/demo/store";

import {
  applyDemoBuyReducer,
  cancelOfferReducer,
  findExistingOffer,
  isLabBbDeposited,
  markOfferAcceptedReducer,
  markOfferAfterDvPReducer,
  placeOfferReducer,
  publishListingReducer,
} from "./demo-store";

const listing = (over: Partial<DemoListing> = {}): DemoListing => ({
  listingId: "listing-1",
  assetId: DEMO_ASSET_ID,
  assetName: "Lote",
  seller: "seller-sol",
  titleAmount: "5",
  priceLabel: "5 Lab USD",
  paymentAmount: "5",
  status: "Open",
  ...over,
});

function emptyState(over: Partial<DemoState> = {}): DemoState {
  return {
    assets: {
      [DEMO_ASSET_ID]: {
        assetId: DEMO_ASSET_ID,
        name: "Finca",
        description: "",
        holders: [],
        entries: [],
        certifications: [],
      },
    },
    listings: [listing()],
    requests: [],
    ethCirculating: "0",
    solIssued: "0",
    ethBalances: {},
    solBalances: {},
    messages: [],
    paused: false,
    ledgerReady: true,
    ...over,
  };
}

describe("placeOfferReducer", () => {
  it("closes listing and prepends Pending offer", () => {
    const next = placeOfferReducer(emptyState(), {
      listing: listing(),
      buyer: "buyer-1",
      now: 1_000,
      transferId: "0xoffer:1",
    });
    expect(next.listings[0]?.status).toBe("Closed");
    expect(next.requests[0]?.status).toBe("Pending");
    expect(next.requests[0]?.buyer).toBe("buyer-1");
    expect(next.messages[0]?.messageId).toBe("offer:0xoffer:1");
  });
});

describe("applyDemoBuyReducer", () => {
  it("is idempotent when already DepositDemo", () => {
    const prev = emptyState({
      listings: [listing({ status: "Closed" })],
      requests: [
        {
          transferId: "0x1",
          assetId: DEMO_ASSET_ID,
          seller: "seller-sol",
          buyer: "buyer-1",
          amount: "5",
          deadline: 1,
          hardDeadline: 2,
          status: "DepositDemo",
          listingId: "listing-1",
        },
      ],
    });
    expect(
      applyDemoBuyReducer(prev, {
        listing: listing(),
        buyer: "buyer-1",
        now: 1,
        transferId: "0xnew",
      }),
    ).toBe(prev);
  });

  it("marks lab Pending 0xbb as DepositDemo", () => {
    const prev = emptyState({
      listings: [listing({ listingId: "listing-lab-rioja" })],
      requests: [
        {
          transferId: "0xbb",
          assetId: DEMO_ASSET_ID,
          seller: "seller-sol",
          buyer: "old",
          amount: "5",
          deadline: 1,
          hardDeadline: 2,
          status: "Pending",
          listingId: "listing-lab-rioja",
        },
      ],
    });
    const next = applyDemoBuyReducer(prev, {
      listing: listing({ listingId: "listing-lab-rioja" }),
      buyer: "buyer-new",
      now: 1,
      transferId: "ignored",
    });
    expect(next.requests[0]?.status).toBe("DepositDemo");
    expect(next.requests[0]?.buyer).toBe("buyer-new");
    expect(next.solBalances["buyer-new"]).toBe("5");
  });
});

describe("publishListingReducer / cancel / accept / dvp", () => {
  it("publishes with asset name from store", () => {
    const next = publishListingReducer(emptyState({ listings: [] }), {
      listingId: "listing:x",
      seller: "seller-sol",
      titleAmount: "9",
    });
    expect(next.listings[0]).toMatchObject({
      listingId: "listing:x",
      titleAmount: "9",
      assetName: "Finca",
      status: "Open",
    });
  });

  it("marks accepted and cancels with reopen", () => {
    const withOffer = placeOfferReducer(emptyState(), {
      listing: listing(),
      buyer: "b",
      now: 1,
      transferId: "0xo",
    });
    const accepted = markOfferAcceptedReducer(withOffer, "0xo");
    expect(accepted.requests[0]?.status).toBe("DepositDemo");

    const cancelled = cancelOfferReducer(accepted, "0xo", "listing-1");
    expect(cancelled.requests).toHaveLength(0);
    expect(cancelled.listings[0]?.status).toBe("Open");
  });

  it("marks after DvP signature", () => {
    const prev = emptyState({
      requests: [
        {
          transferId: "0xo",
          assetId: DEMO_ASSET_ID,
          seller: "s",
          buyer: "b",
          amount: "1",
          deadline: 1,
          hardDeadline: 2,
          status: "Pending",
        },
      ],
    });
    const next = markOfferAfterDvPReducer(prev, "0xo", "sig123");
    expect(next.requests[0]?.status).toBe("DepositDemo");
    expect(next.messages[0]?.messageId).toBe("dvp:sig123");
  });
});

describe("findExistingOffer / isLabBbDeposited", () => {
  it("detects blockers and lab deposit", () => {
    expect(findExistingOffer([], "listing-1")).toBeUndefined();
    expect(
      findExistingOffer(
        [
          {
            transferId: "0x1",
            assetId: DEMO_ASSET_ID,
            seller: "s",
            buyer: "b",
            amount: "1",
            deadline: 1,
            hardDeadline: 2,
            status: "Pending",
            listingId: "listing-1",
          },
        ],
        "listing-1",
      )?.status,
    ).toBe("Pending");
    expect(isLabBbDeposited([])).toBe(false);
    expect(
      isLabBbDeposited([
        {
          transferId: "0xbb",
          assetId: DEMO_ASSET_ID,
          seller: "s",
          buyer: "b",
          amount: "1",
          deadline: 1,
          hardDeadline: 2,
          status: "DepositDemo",
        },
      ]),
    ).toBe(true);
  });
});
