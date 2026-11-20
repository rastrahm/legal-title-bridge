"use client";

import { useState } from "react";

import { useApp } from "@/components/Providers";
import { canSignAttestation, canSignIdentity } from "@/lib/roles";
import { t } from "@/lib/i18n";

/**
 * Verifier / attestor console — EIP-712 field preview before signing.
 */
export default function VerificadorPage() {
  const { locale, roles, canSignEth, setEthAddress, setEthChainId, ethAddress } =
    useApp();
  const dict = t(locale);
  const ready = canSignEth && Boolean(ethAddress);

  const [country, setCountry] = useState("ES");
  const [investorType, setInvestorType] = useState("retail");
  const [expiresAt, setExpiresAt] = useState("1735689600");
  const [signed, setSigned] = useState(false);

  const incomplete = !country || !investorType || !expiresAt;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-10">
      <h1 className="text-3xl font-bold">{dict.navVerifier}</h1>

      <button
        type="button"
        className="rounded-full border border-slate-700 px-4 py-2 text-sm"
        data-testid="btn-connect-eth"
        onClick={() => {
          setEthAddress("0x1111111111111111111111111111111111111111");
          setEthChainId(31337);
        }}
      >
        {dict.connectEth}
      </button>

      <section className="grid max-w-xl gap-3">
        <label className="text-sm" htmlFor="id-country">
          {dict.fieldCountry}
          <input
            id="id-country"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            data-testid="id-country"
            aria-invalid={country ? undefined : true}
            aria-describedby={incomplete ? "id-incomplete" : undefined}
          />
        </label>
        <label className="text-sm" htmlFor="id-type">
          {dict.fieldInvestorType}
          <input
            id="id-type"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
            value={investorType}
            onChange={(e) => setInvestorType(e.target.value)}
            data-testid="id-type"
            aria-invalid={investorType ? undefined : true}
            aria-describedby={incomplete ? "id-incomplete" : undefined}
          />
        </label>
        <label className="text-sm" htmlFor="id-expires">
          {dict.fieldExpires}
          <input
            id="id-expires"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            data-testid="id-expires"
            aria-invalid={expiresAt ? undefined : true}
            aria-describedby={incomplete ? "id-incomplete" : undefined}
          />
        </label>
      </section>

      <aside
        className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm"
        aria-label="EIP-712 preview"
        data-testid="eip712-preview"
      >
        <p>country: {country || "—"}</p>
        <p>investorType: {investorType || "—"}</p>
        <p>expiresAt: {expiresAt || "—"}</p>
      </aside>

      {incomplete ? (
        <p id="id-incomplete" role="alert" className="text-amber-200">
          {dict.incompleteFields}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="btn-sign-identity"
          className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
          disabled={!ready || !canSignIdentity(roles) || incomplete}
          onClick={() => setSigned(true)}
        >
          {dict.btnSignIdentity}
        </button>
        <button
          type="button"
          data-testid="btn-sign-attestation"
          className="rounded-full border border-slate-600 px-4 py-2 text-sm disabled:opacity-40"
          disabled={!ready || !canSignAttestation(roles)}
          onClick={() => setSigned(true)}
        >
          {dict.btnSignAttestation}
        </button>
      </div>

      {signed ? (
        <p className="text-emerald-300" data-testid="signed-ok">
          {dict.signedOk}
        </p>
      ) : null}
    </main>
  );
}
