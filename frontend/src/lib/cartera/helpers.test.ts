import { describe, expect, it } from "vitest";

import type { DemoListing, DemoRequest } from "@/lib/demo/store";

import {
  asErrorMessage,
  buildPendingOffer,
  filterBuyCatalog,
  filterOffersReceived,
  filterSellerListings,
  isSolWalletReady,
  offerStatusLabel,
} from "./helpers";

const SELLER = "EDTzyw3P2wwaLu9VyFUs5EjXziCHaSXCQkbJWhDwM4x5";
const BUYER = "7EcDhSYGxXyscszYEp35KHN8vvw3svRhLNvn5Lf2Sq5H";

const listing = (over: Partial<DemoListing> = {}): DemoListing => ({
  listingId: "listing-1",
  assetId: `0x${"aa".repeat(32)}`,
  assetName: "Lote",
  seller: SELLER,
  titleAmount: "7",
  priceLabel: "7 Lab USD",
  paymentAmount: "7",
  status: "Open",
  ...over,
});

const request = (over: Partial<DemoRequest> = {}): DemoRequest => ({
  transferId: "0x1",
  assetId: `0x${"aa".repeat(32)}`,
  seller: SELLER,
  buyer: BUYER,
  amount: "7",
  deadline: 100,
  hardDeadline: 200,
  status: "Pending",
  ...over,
});

describe("isSolWalletReady", () => {
  it("requires both canSign and address", () => {
    expect(isSolWalletReady(true, SELLER)).toBe(true);
    expect(isSolWalletReady(false, SELLER)).toBe(false);
    expect(isSolWalletReady(true, null)).toBe(false);
  });
});

describe("asErrorMessage", () => {
  it("unwraps Error and stringifies others", () => {
    expect(asErrorMessage(new Error("boom"))).toBe("boom");
    expect(asErrorMessage("plain")).toBe("plain");
  });
});

describe("filters", () => {
  it("keeps seller listings and received offers", () => {
    const mine = listing({ listingId: "mine" });
    const labOther = listing({
      listingId: "lab",
      labExample: true,
      seller: "other-seller",
    });
    expect(filterSellerListings([mine, labOther], SELLER)).toEqual([mine]);

    const pending = request({ transferId: "p" });
    const rejectedLab = request({
      transferId: "r",
      status: "Rejected",
      labExample: true,
    });
    const foreign = request({
      transferId: "f",
      seller: BUYER,
      status: "Pending",
    });
    expect(
      filterOffersReceived([pending, rejectedLab, foreign], SELLER).map(
        (r) => r.transferId,
      ),
    ).toEqual(["p", "r"]);
  });

  it("hides lab catalog outside demo path", () => {
    const real = listing();
    const lab = listing({ listingId: "lab", labExample: true });
    expect(filterBuyCatalog([real, lab], true)).toHaveLength(2);
    expect(filterBuyCatalog([real, lab], false)).toEqual([real]);
  });
});

describe("buildPendingOffer / offerStatusLabel", () => {
  it("builds a Pending offer with deadlines", () => {
    const offer = buildPendingOffer({
      listing: listing(),
      buyer: BUYER,
      now: 1_000,
      transferId: "0xoffer:1",
    });
    expect(offer.status).toBe("Pending");
    expect(offer.buyer).toBe(BUYER);
    expect(offer.deadline).toBe(1_000 + 3600);
    expect(offer.hardDeadline).toBe(1_000 + 3600 + 7 * 86400);
  });

  it("maps reject / deposit / pending labels", () => {
    const labels = {
      rejectCertExpired: "cert",
      rejectNotVerified: "nv",
      buyStatusDeposit: "dep",
      offerPending: "pend",
    };
    expect(
      offerStatusLabel(
        request({ rejectReason: "CERTIFICATION_EXPIRED" }),
        labels,
      ),
    ).toBe("cert");
    expect(
      offerStatusLabel(request({ status: "DepositDemo" }), labels),
    ).toBe("dep");
    expect(offerStatusLabel(request(), labels)).toBe("pend");
  });
});
