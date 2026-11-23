"use client";

import { useMemo, useState } from "react";

import { CarteraShell } from "@/app/cartera/CarteraShell";
import { useApp } from "@/components/Providers";
import {
  buildFirmarHref,
  type DvPHandoffPayload,
} from "@/lib/cartera/dvp-handoff";
import {
  isSolanaPubkey,
  sellerPrepareDvPHandoff,
  useDemoPurchasePath,
} from "@/lib/cartera/purchase";
import {
  DEMO_ASSET_ID,
  LAB_PAYMENT_LABEL,
  type DemoRequest,
} from "@/lib/demo/store";
import { formatCountdown, snapshotDeadlines } from "@/lib/deadlines";
import { t } from "@/lib/i18n";

/**
 * Seller workspace — publish a lot and review offers received.
 */
export default function CarteraVenderPage() {
  const { locale, demo, canSignSol, setDemo, solAddress } = useApp();
  const dict = t(locale);
  const now = 1_700_000_000;
  const [notice, setNotice] = useState<string | null>(null);
  const [amount, setAmount] = useState("7");
  const [busy, setBusy] = useState(false);
  const [handoffHref, setHandoffHref] = useState<string | null>(null);
  const walletReady = canSignSol && Boolean(solAddress);
  const demoPath = useDemoPurchasePath();

  const myListings = useMemo(
    () =>
      demo.listings.filter(
        (l) =>
          !l.labExample ||
          l.seller === solAddress ||
          l.seller === "seller-sol",
      ),
    [demo.listings, solAddress],
  );

  const offersReceived = useMemo(() => {
    return demo.requests.filter((r) => {
      if (r.status === "Rejected" && r.labExample) return true; // show cert-expired example
      if (r.status !== "Pending" && r.status !== "DepositDemo") return false;
      if (r.labExample) return true;
      return Boolean(solAddress) && r.seller === solAddress;
    });
  }, [demo.requests, solAddress]);

  function publishListing(price: string) {
    if (!walletReady) {
      setNotice(dict.connectWalletFirst);
      return;
    }
    const listingId = `listing:${Date.now().toString(16)}`;
    const asset = demo.assets[DEMO_ASSET_ID];
    setDemo((prev) => ({
      ...prev,
      listings: [
        {
          listingId,
          assetId: DEMO_ASSET_ID,
          assetName: asset?.name ?? "Lote",
          seller: solAddress ?? "seller-sol",
          titleAmount: price,
          priceLabel: `${price} ${LAB_PAYMENT_LABEL}`,
          paymentAmount: price,
          status: "Open",
        },
        ...prev.listings,
      ],
    }));
    setNotice(dict.saleCreated);
  }

  function statusLabel(r: DemoRequest): string {
    if (r.rejectReason === "CERTIFICATION_EXPIRED") return dict.rejectCertExpired;
    if (r.rejectReason === "NOT_VERIFIED") return dict.rejectNotVerified;
    if (r.status === "DepositDemo") return dict.buyStatusDeposit;
    if (r.rejectReason) return `${r.status} — ${r.rejectReason}`;
    return r.status === "Pending" ? dict.offerPending : r.status;
  }

  async function acceptOffer(r: DemoRequest) {
    if (!walletReady || !solAddress) {
      setNotice(dict.connectWalletFirst);
      return;
    }
    if (r.status === "DepositDemo") {
      setNotice(dict.buyAlreadyDone);
      return;
    }

    const markAccepted = (messageId: string, noticeMsg?: string) => {
      setDemo((prev) => ({
        ...prev,
        requests: prev.requests.map((x) =>
          x.transferId === r.transferId
            ? { ...x, status: "DepositDemo" as const }
            : x,
        ),
        messages: [
          {
            messageId,
            status: "seen" as const,
            direction: "sol_to_eth" as const,
          },
          ...prev.messages,
        ],
      }));
      setNotice(noticeMsg ?? dict.offerAccepted);
    };

    // E2E / lab fixtures: silent UI. Real seller+buyer on testnet → Phantom DvP.
    const canOnchain =
      !demoPath &&
      !r.labExample &&
      isSolanaPubkey(r.seller) &&
      isSolanaPubkey(r.buyer);

    if (!canOnchain) {
      markAccepted(`accept:${r.transferId}`);
      return;
    }

    if (r.seller !== solAddress) {
      setNotice(dict.acceptMustBeSeller);
      return;
    }

    setBusy(true);
    setHandoffHref(null);
    setNotice(dict.buyPhantomStart);
    try {
      const payload: DvPHandoffPayload = await sellerPrepareDvPHandoff({
        seller: r.seller,
        buyer: r.buyer,
        titleAmount: r.amount,
        paymentAmount: r.amount,
        assetIdHex: r.assetId,
        offerTransferId: r.transferId,
        onStatus: (msg) => setNotice(msg),
      });
      const href = buildFirmarHref(payload);
      setHandoffHref(href);
      setNotice(dict.dvpHandoffReady);
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copyHandoffLink() {
    if (!handoffHref) return;
    try {
      await navigator.clipboard.writeText(handoffHref);
      setNotice(dict.dvpHandoffCopied);
    } catch {
      setNotice(handoffHref);
    }
  }

  function cancelOffer(r: DemoRequest) {
    setDemo((prev) => ({
      ...prev,
      requests: prev.requests.filter((x) => x.transferId !== r.transferId),
      listings: prev.listings.map((l) =>
        l.listingId === r.listingId ? { ...l, status: "Open" as const } : l,
      ),
    }));
    setNotice(dict.saleCancelled);
  }

  return (
    <CarteraShell
      title={dict.carteraSellTitle}
      mode="vender"
      notice={notice}
    >
      <p className="max-w-2xl text-sm text-slate-400">{dict.carteraSellLead}</p>

      {handoffHref ? (
        <section
          className="space-y-3 rounded-2xl border border-amber-800/60 bg-amber-950/30 p-5"
          data-testid="dvp-handoff-panel"
        >
          <p className="text-sm text-amber-100">{dict.dvpHandoffReady}</p>
          <p className="break-all font-mono text-xs text-slate-400">{handoffHref}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
              data-testid="btn-copy-dvp-handoff"
              onClick={() => {
                void copyHandoffLink();
              }}
            >
              {dict.dvpHandoffCopy}
            </button>
            <a
              href={handoffHref}
              className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-200"
              data-testid="link-open-dvp-firmar"
            >
              {dict.dvpFirmarTitle}
            </a>
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold">{dict.publishListing}</h2>
        <p className="text-sm text-slate-400">{dict.publishListingHint}</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm" htmlFor="sell-amount">
            {dict.fieldTitleAmount}
            <input
              id="sell-amount"
              className="mt-1 block w-28 rounded border border-slate-700 bg-slate-950 px-3 py-2"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="sell-amount"
            />
          </label>
          <p className="pb-2 text-sm text-slate-500">
            {dict.priceWith} {LAB_PAYMENT_LABEL}
          </p>
          <button
            type="button"
            className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
            disabled={!walletReady}
            data-testid="btn-sell"
            onClick={() => publishListing(amount || "7")}
          >
            {dict.btnSell}
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-600 px-3 py-2 text-xs disabled:opacity-40"
            data-testid="btn-retry-price"
            disabled={!walletReady}
            onClick={() => publishListing("9")}
          >
            {dict.btnSell} · 9
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{dict.myListingsTitle}</h2>
        {myListings.filter((l) => l.status === "Open" && !l.labExample).length ===
        0 ? (
          <p className="text-sm text-slate-500">{dict.noListingsYet}</p>
        ) : (
          <ul className="space-y-2">
            {myListings
              .filter((l) => l.status === "Open" && !l.labExample)
              .map((l) => (
                <li
                  key={l.listingId}
                  className="rounded-xl border border-slate-800 px-4 py-3"
                  data-testid={`listing-${l.listingId}`}
                >
                  <p className="font-medium text-slate-50">{l.assetName}</p>
                  <p className="text-sm text-slate-400">
                    {l.titleAmount} · {l.priceLabel}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{dict.offersReceivedTitle}</h2>
        <p className="text-sm text-slate-400">{dict.offersReceivedHint}</p>
        {offersReceived.length === 0 ? (
          <p className="text-sm text-slate-500">{dict.noOffersYet}</p>
        ) : (
          offersReceived.map((r) => {
            const snap = snapshotDeadlines(r.deadline, r.hardDeadline, now);
            const assetName =
              demo.assets[r.assetId]?.name ?? r.assetId.slice(0, 12);
            const canAccept = r.status === "Pending";
            const canCancel =
              r.status === "Pending" || r.status === "DepositDemo";
            return (
              <article
                key={r.transferId}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
                data-testid={`request-${r.transferId}`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-50">{assetName}</p>
                  {r.labExample ? (
                    <span className="rounded-full border border-amber-800/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
                      {dict.labExampleBadge}
                    </span>
                  ) : null}
                </div>
                <p
                  className={
                    r.status === "DepositDemo"
                      ? "font-medium text-emerald-300"
                      : "text-sm text-slate-300"
                  }
                  data-testid={`request-status-${r.transferId}`}
                >
                  {statusLabel(r)}
                </p>
                <dl className="mt-2 space-y-1 text-sm text-slate-400">
                  <div>
                    <dt className="inline text-slate-500">
                      {dict.requestBuyer}:{" "}
                    </dt>
                    <dd
                      className="inline font-mono text-xs"
                      data-testid={`request-buyer-${r.transferId}`}
                    >
                      {r.buyer}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">
                      {dict.requestAmount}:{" "}
                    </dt>
                    <dd
                      className="inline"
                      data-testid={`request-amount-${r.transferId}`}
                    >
                      {r.priceLabel ?? r.amount}
                    </dd>
                  </div>
                  <div className="hidden">
                    <span data-testid={`request-seller-${r.transferId}`}>
                      {r.seller}
                    </span>
                  </div>
                </dl>
                <p className="mt-2 text-sm text-slate-500">
                  Countdown: {formatCountdown(snap.secondsToDeadline)}
                </p>
                {canAccept || canCancel ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canAccept ? (
                      <button
                        type="button"
                        className="rounded-full bg-cyan-300 px-3 py-1 text-sm font-semibold text-slate-950 disabled:opacity-40"
                        disabled={!walletReady || busy}
                        data-testid="btn-accept-offer"
                        onClick={() => {
                          void acceptOffer(r);
                        }}
                      >
                        {dict.btnAcceptOffer}
                      </button>
                    ) : null}
                    {canCancel ? (
                      <button
                        type="button"
                        className="rounded-full border border-slate-600 px-3 py-1 text-sm disabled:opacity-40"
                        disabled={!walletReady}
                        data-testid="btn-cancel-sale"
                        onClick={() => cancelOffer(r)}
                      >
                        {dict.btnCancelSale}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </section>

      <p className="text-sm text-slate-500" data-testid="deadline-hint">
        {dict.deadlineHint}
      </p>
    </CarteraShell>
  );
}
