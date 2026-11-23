"use client";

import { useMemo, useState } from "react";

import { CarteraShell } from "@/app/cartera/CarteraShell";
import { useApp } from "@/components/Providers";
import {
  isSolanaPubkey,
  useDemoPurchasePath,
} from "@/lib/cartera/purchase";
import { LAB_PAYMENT_LABEL, type DemoListing } from "@/lib/demo/store";
import { t } from "@/lib/i18n";
import { hexTimeSuffix, unixSeconds } from "@/lib/time";

/**
 * Buyer workspace — catalog.
 * Testnet: places a Pending offer; seller Accept on /vender runs Phantom DvP.
 */
export default function CarteraComprarPage() {
  const { locale, demo, canSignSol, setDemo, solAddress } = useApp();
  const dict = t(locale);
  const [notice, setNotice] = useState<string | null>(null);
  const walletReady = canSignSol && Boolean(solAddress);
  const demoPath = useDemoPurchasePath();

  const catalog = useMemo(() => {
    const open = demo.listings.filter((l) => l.status === "Open");
    // Lab fixtures only in E2E; real catalog needs real seller pubkeys.
    if (demoPath) return open;
    return open.filter((l) => !l.labExample && isSolanaPubkey(l.seller));
  }, [demo.listings, demoPath]);

  function applyDemoBuy(listing: DemoListing) {
    const now = unixSeconds();
    setDemo((prev) => {
      const alreadyDone = prev.requests.find(
        (r) =>
          r.listingId === listing.listingId && r.status === "DepositDemo",
      );
      if (alreadyDone) return prev;

      const pending = prev.requests.find(
        (r) =>
          r.status === "Pending" &&
          (r.listingId === listing.listingId ||
            (listing.listingId === "listing-lab-rioja" &&
              r.transferId === "0xbb")),
      );

      if (pending) {
        return {
          ...prev,
          requests: prev.requests.map((x) =>
            x.transferId === pending.transferId
              ? {
                  ...x,
                  buyer: solAddress ?? x.buyer,
                  status: "DepositDemo" as const,
                }
              : x,
          ),
          solBalances: {
            ...prev.solBalances,
            [solAddress ?? "buyer"]: String(
              Number(prev.solBalances[solAddress ?? ""] ?? 0) +
                Number(pending.amount),
            ),
          },
          messages: [
            {
              messageId: `deposit:${pending.transferId}`,
              status: "seen" as const,
              direction: "sol_to_eth" as const,
            },
            ...prev.messages,
          ],
        };
      }

      const transferId = `0xoffer:${hexTimeSuffix()}`;
      return {
        ...prev,
        listings: prev.listings.map((l) =>
          l.listingId === listing.listingId
            ? { ...l, status: "Closed" as const }
            : l,
        ),
        requests: [
          {
            transferId,
            assetId: listing.assetId,
            seller: listing.seller,
            buyer: solAddress ?? "buyer",
            amount: listing.titleAmount,
            deadline: now + 3600,
            hardDeadline: now + 3600 + 7 * 86400,
            status: "Pending" as const,
            listingId: listing.listingId,
            priceLabel: listing.priceLabel,
          },
          ...prev.requests,
        ],
        messages: [
          {
            messageId: `offer:${transferId}`,
            status: "seen" as const,
            direction: "sol_to_eth" as const,
          },
          ...prev.messages,
        ],
      };
    });
    setNotice(dict.buyStarted);
  }

  function placeOffer(listing: DemoListing) {
    const now = unixSeconds();
    const existing = demo.requests.find(
      (r) =>
        r.listingId === listing.listingId &&
        (r.status === "Pending" || r.status === "DepositDemo"),
    );
    if (existing) {
      setNotice(
        existing.status === "DepositDemo"
          ? dict.buyAlreadyDone
          : dict.offerAlreadyPending,
      );
      return;
    }
    const transferId = `0xoffer:${hexTimeSuffix()}`;
    setDemo((prev) => ({
      ...prev,
      listings: prev.listings.map((l) =>
        l.listingId === listing.listingId
          ? { ...l, status: "Closed" as const }
          : l,
      ),
      requests: [
        {
          transferId,
          assetId: listing.assetId,
          seller: listing.seller,
          buyer: solAddress ?? "buyer",
          amount: listing.titleAmount,
          deadline: now + 3600,
          hardDeadline: now + 3600 + 7 * 86400,
          status: "Pending" as const,
          listingId: listing.listingId,
          priceLabel: listing.priceLabel,
        },
        ...prev.requests,
      ],
      messages: [
        {
          messageId: `offer:${transferId}`,
          status: "seen" as const,
          direction: "sol_to_eth" as const,
        },
        ...prev.messages,
      ],
    }));
    setNotice(dict.buyStarted);
  }

  async function buyListing(listing: DemoListing) {
    if (!walletReady || !solAddress) {
      setNotice(dict.connectWalletFirst);
      return;
    }
    // Real wallets cannot self-buy; E2E stub uses the same "seller-sol" label.
    if (!demoPath && listing.seller === solAddress) {
      setNotice(dict.buySelfBlocked);
      return;
    }

    const alreadyDone = demo.requests.some(
      (r) =>
        r.listingId === listing.listingId && r.status === "DepositDemo",
    );
    if (alreadyDone) {
      setNotice(dict.buyAlreadyDone);
      return;
    }

    // E2E local: silent deposit. Testnet: place Pending offer; seller Accept → Phantom DvP.
    if (demoPath) {
      applyDemoBuy(listing);
      return;
    }
    placeOffer(listing);
  }

  const alreadyBoughtLab = demo.requests.some(
    (r) => r.transferId === "0xbb" && r.status === "DepositDemo",
  );

  return (
    <CarteraShell
      title={dict.carteraBuyTitle}
      mode="comprar"
      notice={notice}
    >
      <p className="max-w-2xl text-sm text-slate-400">{dict.carteraBuyLead}</p>
      <p className="text-sm text-slate-500">
        {dict.payWithHint}{" "}
        <span className="text-slate-300">{LAB_PAYMENT_LABEL}</span>.{" "}
        {demoPath ? null : dict.buyPhantomHint}
      </p>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{dict.catalogTitle}</h2>
        {catalog.length === 0 ? (
          <p className="text-sm text-slate-500">{dict.catalogEmpty}</p>
        ) : (
          <ul className="space-y-3">
            {catalog.map((listing) => {
              const isLabBb =
                listing.listingId === "listing-lab-rioja" && alreadyBoughtLab;
              return (
                <li
                  key={listing.listingId}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-4"
                  data-testid={`product-${listing.listingId}`}
                >
                  <div>
                    <p className="text-lg font-medium text-slate-50">
                      {listing.assetName}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {listing.titleAmount} u. · {listing.priceLabel}
                    </p>
                    {listing.labExample ? (
                      <span className="mt-2 inline-block rounded-full border border-amber-800/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
                        {dict.labExampleBadge}
                      </span>
                    ) : null}
                    {listing.listingId === "listing-lab-rioja" ? (
                      <p
                        className="mt-2 text-sm text-emerald-300"
                        data-testid="request-status-0xbb"
                      >
                        {alreadyBoughtLab
                          ? dict.buyStatusDeposit
                          : dict.offerAvailable}
                      </p>
                    ) : null}
                    {listing.listingId === "listing-lab-rioja" ? (
                      <p
                        className="sr-only"
                        data-testid="request-buyer-0xbb"
                      >
                        {demo.requests.find((r) => r.transferId === "0xbb")
                          ?.buyer ?? "—"}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
                    disabled={!walletReady || isLabBb}
                    data-testid="btn-buy"
                    onClick={() => {
                      void buyListing(listing);
                    }}
                  >
                    {dict.btnBuy}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </CarteraShell>
  );
}
