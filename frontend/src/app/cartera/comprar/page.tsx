"use client";

import { useMemo, useState } from "react";

import { CarteraShell } from "@/app/cartera/CarteraShell";
import { useApp } from "@/components/Providers";
import {
  applyDemoBuyReducer,
  findExistingOffer,
  isLabBbDeposited,
  placeOfferReducer,
} from "@/lib/cartera/demo-store";
import {
  filterBuyCatalog,
  isSolWalletReady,
} from "@/lib/cartera/helpers";
import { useDemoPurchasePath } from "@/lib/cartera/purchase";
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
  const walletReady = isSolWalletReady(canSignSol, solAddress);
  const demoPath = useDemoPurchasePath();

  const catalog = useMemo(
    () => filterBuyCatalog(demo.listings, demoPath),
    [demo.listings, demoPath],
  );

  function buyListing(listing: DemoListing) {
    if (!walletReady || !solAddress) {
      setNotice(dict.connectWalletFirst);
      return;
    }
    // Real wallets cannot self-buy; E2E stub uses the same "seller-sol" label.
    if (!demoPath && listing.seller === solAddress) {
      setNotice(dict.buySelfBlocked);
      return;
    }

    const existing = findExistingOffer(demo.requests, listing.listingId);
    if (existing?.status === "DepositDemo") {
      setNotice(dict.buyAlreadyDone);
      return;
    }
    if (!demoPath && existing?.status === "Pending") {
      setNotice(dict.offerAlreadyPending);
      return;
    }

    const now = unixSeconds();
    const transferId = `0xoffer:${hexTimeSuffix()}`;
    const buyer = solAddress;

    if (demoPath) {
      setDemo((prev) =>
        applyDemoBuyReducer(prev, { listing, buyer, now, transferId }),
      );
    } else {
      setDemo((prev) =>
        placeOfferReducer(prev, { listing, buyer, now, transferId }),
      );
    }
    setNotice(dict.buyStarted);
  }

  const alreadyBoughtLab = isLabBbDeposited(demo.requests);

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
                    onClick={() => buyListing(listing)}
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
