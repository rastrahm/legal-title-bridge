/**
 * Pure DemoState reducers for cartera buy/sell flows.
 * Pages call these inside setDemo — no wallet/RPC here.
 */

import { buildPendingOffer } from "@/lib/cartera/helpers";
import {
  DEMO_ASSET_ID,
  LAB_PAYMENT_LABEL,
  type DemoListing,
  type DemoState,
} from "@/lib/demo/store";

const LAB_LISTING_ID = "listing-lab-rioja";
const LAB_TRANSFER_ID = "0xbb";

function prependSeenMessage(
  prev: DemoState,
  messageId: string,
  direction: "eth_to_sol" | "sol_to_eth" = "sol_to_eth",
): DemoState["messages"] {
  return [
    { messageId, status: "seen" as const, direction },
    ...prev.messages,
  ];
}

/** Close listing and append a Pending offer (testnet / silent place). */
export function placeOfferReducer(
  prev: DemoState,
  args: {
    listing: DemoListing;
    buyer: string;
    now: number;
    transferId: string;
  },
): DemoState {
  const { listing, buyer, now, transferId } = args;
  return {
    ...prev,
    listings: prev.listings.map((l) =>
      l.listingId === listing.listingId
        ? { ...l, status: "Closed" as const }
        : l,
    ),
    requests: [
      buildPendingOffer({ listing, buyer, now, transferId }),
      ...prev.requests,
    ],
    messages: prependSeenMessage(prev, `offer:${transferId}`),
  };
}

/**
 * E2E demo buy: either mark existing Pending as DepositDemo or place a new offer.
 */
export function applyDemoBuyReducer(
  prev: DemoState,
  args: {
    listing: DemoListing;
    buyer: string;
    now: number;
    transferId: string;
  },
): DemoState {
  const { listing, buyer, now, transferId } = args;

  const alreadyDone = prev.requests.find(
    (r) =>
      r.listingId === listing.listingId && r.status === "DepositDemo",
  );
  if (alreadyDone) return prev;

  const pending = prev.requests.find(
    (r) =>
      r.status === "Pending" &&
      (r.listingId === listing.listingId ||
        (listing.listingId === LAB_LISTING_ID &&
          r.transferId === LAB_TRANSFER_ID)),
  );

  if (pending) {
    return {
      ...prev,
      requests: prev.requests.map((x) =>
        x.transferId === pending.transferId
          ? {
              ...x,
              buyer: buyer || x.buyer,
              status: "DepositDemo" as const,
            }
          : x,
      ),
      solBalances: {
        ...prev.solBalances,
        [buyer || "buyer"]: String(
          Number(prev.solBalances[buyer] ?? 0) + Number(pending.amount),
        ),
      },
      messages: prependSeenMessage(prev, `deposit:${pending.transferId}`),
    };
  }

  return placeOfferReducer(prev, { listing, buyer, now, transferId });
}

/** Publish a new Open listing for the connected seller. */
export function publishListingReducer(
  prev: DemoState,
  args: {
    listingId: string;
    seller: string;
    titleAmount: string;
    assetName?: string;
  },
): DemoState {
  const { listingId, seller, titleAmount, assetName } = args;
  const asset = prev.assets[DEMO_ASSET_ID];
  return {
    ...prev,
    listings: [
      {
        listingId,
        assetId: DEMO_ASSET_ID,
        assetName: assetName ?? asset?.name ?? "Lote",
        seller,
        titleAmount,
        priceLabel: `${titleAmount} ${LAB_PAYMENT_LABEL}`,
        paymentAmount: titleAmount,
        status: "Open",
      },
      ...prev.listings,
    ],
  };
}

/** Mark offer DepositDemo after silent accept (demo path). */
export function markOfferAcceptedReducer(
  prev: DemoState,
  transferId: string,
): DemoState {
  return {
    ...prev,
    requests: prev.requests.map((x) =>
      x.transferId === transferId
        ? { ...x, status: "DepositDemo" as const }
        : x,
    ),
    messages: prependSeenMessage(prev, `accept:${transferId}`),
  };
}

/** Cancel offer and reopen its listing if linked. */
export function cancelOfferReducer(
  prev: DemoState,
  transferId: string,
  listingId: string | undefined,
): DemoState {
  return {
    ...prev,
    requests: prev.requests.filter((x) => x.transferId !== transferId),
    listings: prev.listings.map((l) =>
      listingId && l.listingId === listingId
        ? { ...l, status: "Open" as const }
        : l,
    ),
  };
}

/** After buyer completes Phantom DvP handoff, mark linked offer deposited. */
export function markOfferAfterDvPReducer(
  prev: DemoState,
  offerTransferId: string,
  signature: string,
): DemoState {
  return {
    ...prev,
    requests: prev.requests.map((x) =>
      x.transferId === offerTransferId
        ? { ...x, status: "DepositDemo" as const }
        : x,
    ),
    messages: prependSeenMessage(prev, `dvp:${signature}`),
  };
}

/** True when lab fixture 0xbb is already DepositDemo. */
export function isLabBbDeposited(requests: DemoState["requests"]): boolean {
  return requests.some(
    (r) => r.transferId === LAB_TRANSFER_ID && r.status === "DepositDemo",
  );
}

/** Existing Pending/DepositDemo for a listing blocks a new offer. */
export function findExistingOffer(
  requests: DemoState["requests"],
  listingId: string,
) {
  return requests.find(
    (r) =>
      r.listingId === listingId &&
      (r.status === "Pending" || r.status === "DepositDemo"),
  );
}
