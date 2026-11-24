"use client";

import { useMemo, useState } from "react";

import { ContextualHelp } from "@/components/ContextualHelp";
import { useApp } from "@/components/Providers";
import { useConnectWallets } from "@/hooks/useConnectWallets";
import { resolveAddresses } from "@/lib/addresses";
import { attestOnChain, registerAssertionOnChain } from "@/lib/contracts/registry";
import { dateInputToUnixExpiry, defaultExpiryDateInput } from "@/lib/dates";
import { ISO_COUNTRIES, countryLabel } from "@/lib/iso-countries";
import { isE2eLab } from "@/lib/wallets/env";
import { canSignAttestation, canSignIdentity } from "@/lib/roles";
import { t } from "@/lib/i18n";

/** Lab fixture holder (issue recipient / E2E). Not a Phantom-derived buyer id. */
const LAB_HOLDER =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const DEFAULT_ASSET =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const selectClass =
  "mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2";

export interface VerificadorClientProps {
  /** Prefill holder from buyer onboarding (?holder=). */
  initialHolder?: string | null;
}

function isHolderBytes32(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

/**
 * Verifier / attestor console — human form fields + on-chain EIP-712 submit.
 */
export function VerificadorClient({
  initialHolder = null,
}: VerificadorClientProps) {
  const { locale, roles, canSignEth, ethAddress } = useApp();
  const { connectEth, error: connectError, busy: connectBusy } =
    useConnectWallets();
  const dict = t(locale);
  const addresses = resolveAddresses();
  const ready = canSignEth && Boolean(ethAddress);

  const [holder, setHolder] = useState(() =>
    initialHolder && isHolderBytes32(initialHolder)
      ? initialHolder
      : LAB_HOLDER,
  );
  const usingLabHolder = holder.toLowerCase() === LAB_HOLDER;
  const [country, setCountry] = useState("724");
  const [investorType, setInvestorType] = useState("1");
  const [expiresDate, setExpiresDate] = useState(() => defaultExpiryDateInput());
  const [assetId, setAssetId] = useState(DEFAULT_ASSET);
  const [attestKind, setAttestKind] = useState("0");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const incomplete = !holder || !country || !investorType || !expiresDate;

  const expiryUnix = useMemo(() => {
    try {
      return dateInputToUnixExpiry(expiresDate);
    } catch {
      return null;
    }
  }, [expiresDate]);

  const countryName =
    ISO_COUNTRIES.find((c) => String(c.code) === country) != null
      ? countryLabel(
          ISO_COUNTRIES.find((c) => String(c.code) === country)!,
          locale,
        )
      : "—";

  async function onSignIdentity() {
    setError(null);
    setStatus(null);
    if (isE2eLab()) {
      setStatus(dict.signedOk);
      return;
    }
    if (expiryUnix == null) {
      setError("Fecha de vencimiento inválida");
      return;
    }
    setBusy(true);
    try {
      const result = await registerAssertionOnChain(addresses.identityRegistry, {
        holder,
        country: Number(country),
        investorType: Number(investorType),
        expiry: expiryUnix,
      });
      setStatus(`Identidad registrada — ${result.txHash}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSignAttestation() {
    setError(null);
    setStatus(null);
    if (isE2eLab()) {
      setStatus(dict.signedOk);
      return;
    }
    if (expiryUnix == null) {
      setError("Fecha de vencimiento inválida");
      return;
    }
    setBusy(true);
    try {
      const kindLabel =
        attestKind === "1"
          ? dict.attestKindRegistral
          : dict.attestKindExistence;
      const result = await attestOnChain(addresses.attestationRegistry, {
        assetId,
        kind: Number(attestKind),
        expiry: expiryUnix,
      });
      setStatus(`Certificación «${kindLabel}» OK — ${result.txHash}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-10">
      <h1 className="text-3xl font-bold">{dict.navVerifier}</h1>
      <ContextualHelp screen="verificador" />
      <p className="max-w-2xl text-sm text-slate-400">{dict.verifierHintIdentity}</p>

      <button
        type="button"
        className="rounded-full border border-slate-700 px-4 py-2 text-sm"
        data-testid="btn-connect-eth"
        disabled={connectBusy}
        onClick={() => {
          void connectEth().catch(() => undefined);
        }}
      >
        {dict.connectEth}
      </button>
      {connectError ? (
        <p role="alert" className="text-sm text-rose-300" data-testid="connect-eth-error">
          {connectError}
        </p>
      ) : null}
      <p className="text-sm text-slate-400" data-testid="eth-address">
        {ethAddress ?? "—"}
      </p>

      <section className="grid max-w-xl gap-4">
        <label className="text-sm" htmlFor="id-holder">
          {dict.fieldHolder}
          <input
            id="id-holder"
            className={`${selectClass} font-mono text-xs`}
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            data-testid="id-holder"
          />
        </label>
        {usingLabHolder ? (
          <p
            role="status"
            className="text-sm text-amber-200"
            data-testid="lab-holder-warn"
          >
            {dict.verifierLabHolderWarn}
          </p>
        ) : null}

        <label className="text-sm" htmlFor="id-country">
          {dict.fieldCountry}
          <select
            id="id-country"
            className={selectClass}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            data-testid="id-country"
            aria-invalid={country ? undefined : true}
            aria-describedby={incomplete ? "id-incomplete" : undefined}
          >
            <option value="">{dict.selectPlaceholder}</option>
            {ISO_COUNTRIES.map((c) => (
              <option key={c.code} value={String(c.code)}>
                {countryLabel(c, locale)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm" htmlFor="id-type">
          {dict.fieldInvestorType}
          <select
            id="id-type"
            className={selectClass}
            value={investorType}
            onChange={(e) => setInvestorType(e.target.value)}
            data-testid="id-type"
            aria-invalid={investorType ? undefined : true}
            aria-describedby={incomplete ? "id-incomplete" : undefined}
          >
            <option value="">{dict.selectPlaceholder}</option>
            <option value="1">{dict.investorRetail}</option>
            <option value="2">{dict.investorInstitutional}</option>
          </select>
        </label>

        <label className="text-sm" htmlFor="id-expires">
          {dict.fieldExpires}
          <input
            id="id-expires"
            type="date"
            className={selectClass}
            value={expiresDate}
            onChange={(e) => setExpiresDate(e.target.value)}
            data-testid="id-expires"
            aria-invalid={expiresDate ? undefined : true}
            aria-describedby={incomplete ? "id-incomplete" : undefined}
          />
        </label>

        <label className="text-sm" htmlFor="id-asset">
          {dict.fieldAssetId}
          <input
            id="id-asset"
            className={`${selectClass} font-mono text-xs`}
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            data-testid="id-asset"
          />
        </label>

        <label className="text-sm" htmlFor="id-kind">
          {dict.fieldAttestKind}
          <select
            id="id-kind"
            className={selectClass}
            value={attestKind}
            onChange={(e) => setAttestKind(e.target.value)}
            data-testid="id-kind"
          >
            <option value="0">{dict.attestKindExistence}</option>
            <option value="1">{dict.attestKindRegistral}</option>
          </select>
        </label>
      </section>

      <aside
        className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300"
        aria-label="EIP-712 preview"
        data-testid="eip712-preview"
      >
        <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
          Vista previa (lo que va a la cadena)
        </p>
        <p>País: {countryName} → código {country || "—"}</p>
        <p>
          Inversor:{" "}
          {investorType === "2"
            ? dict.investorInstitutional
            : investorType === "1"
              ? dict.investorRetail
              : "—"}
        </p>
        <p>
          Vence: {expiresDate || "—"}
          {expiryUnix != null ? ` → ${expiryUnix}` : ""}
        </p>
        <p>
          Certificación:{" "}
          {attestKind === "1"
            ? dict.attestKindRegistral
            : dict.attestKindExistence}
        </p>
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
          disabled={!ready || !canSignIdentity(roles) || incomplete || busy}
          onClick={() => void onSignIdentity()}
        >
          {dict.btnSignIdentity}
        </button>
        <button
          type="button"
          data-testid="btn-sign-attestation"
          className="rounded-full border border-slate-600 px-4 py-2 text-sm disabled:opacity-40"
          disabled={!ready || !canSignAttestation(roles) || busy}
          onClick={() => void onSignAttestation()}
        >
          {dict.btnSignAttestation}
        </button>
      </div>

      {status ? (
        <p className="break-all text-emerald-300" data-testid="signed-ok">
          {status}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="break-all text-sm text-rose-300"
          data-testid="sign-error"
        >
          {error}
        </p>
      ) : null}

      <p className="max-w-2xl text-xs text-slate-500">{dict.verifierHintAttest}</p>
    </main>
  );
}
