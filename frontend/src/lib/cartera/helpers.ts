/**
 * Pure cartera UI helpers — filters, offer shaping, wallet/error display.
 * DvP orchestration stays in purchase.ts / dvp-handoff.ts.
 */

import { isSolanaPubkey } from "@/lib/cartera/purchase";
import type { DemoListing, DemoRequest } from "@/lib/demo/store";

/** Phantom connected and can sign on Solana. */
export function isSolWalletReady(
  canSignSol: boolean,
  solAddress: string | null | undefined,
): boolean {
  return canSignSol && Boolean(solAddress);
}

/** Normalize unknown thrown values for notice banners. */
export function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Seller's own open listings (exclude other users' lab fixtures). */
export function filterSellerListings(
  listings: DemoListing[],
  solAddress: string | null | undefined,
): DemoListing[] {
  return listings.filter(
    (l) =>
      !l.labExample ||
      l.seller === solAddress ||
      l.seller === "seller-sol",
  );
}

/** Offers the seller should review (pending/deposit + lab reject examples). */
export function filterOffersReceived(
  requests: DemoRequest[],
  solAddress: string | null | undefined,
): DemoRequest[] {
  return requests.filter((r) => {
    if (r.status === "Rejected" && r.labExample) return true;
    if (r.status !== "Pending" && r.status !== "DepositDemo") return false;
    if (r.labExample) return true;
    return Boolean(solAddress) && r.seller === solAddress;
  });
}

/** Buy catalog: open listings; hide lab fixtures outside E2E demo path. */
export function filterBuyCatalog(
  listings: DemoListing[],
  demoPath: boolean,
): DemoListing[] {
  const open = listings.filter((l) => l.status === "Open");
  if (demoPath) return open;
  return open.filter((l) => !l.labExample && isSolanaPubkey(l.seller));
}

export interface PendingOfferInput {
  listing: DemoListing;
  buyer: string;
  now: number;
  transferId: string;
}

/** Shape a Pending offer from a catalog listing (shared by demo + testnet buy). */
export function buildPendingOffer(input: PendingOfferInput): DemoRequest {
  const { listing, buyer, now, transferId } = input;
  return {
    transferId,
    assetId: listing.assetId,
    seller: listing.seller,
    buyer,
    amount: listing.titleAmount,
    deadline: now + 3600,
    hardDeadline: now + 3600 + 7 * 86400,
    status: "Pending",
    listingId: listing.listingId,
    priceLabel: listing.priceLabel,
  };
}

export interface OfferStatusLabels {
  rejectCertExpired: string;
  rejectNotVerified: string;
  buyStatusDeposit: string;
  offerPending: string;
}

/** Human status line for an offer card. */
export function offerStatusLabel(
  r: DemoRequest,
  labels: OfferStatusLabels,
): string {
  if (r.rejectReason === "CERTIFICATION_EXPIRED") return labels.rejectCertExpired;
  if (r.rejectReason === "NOT_VERIFIED") return labels.rejectNotVerified;
  if (r.status === "DepositDemo") return labels.buyStatusDeposit;
  if (r.rejectReason) return `${r.status} — ${r.rejectReason}`;
  return r.status === "Pending" ? labels.offerPending : r.status;
}
