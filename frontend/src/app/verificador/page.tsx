import { VerificadorClient } from "./VerificadorClient";

/**
 * Verifier route — optional ?holder= bytes32 from buyer onboarding (not addresses from URL for contracts).
 */
export default async function VerificadorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = sp.holder;
  const holder = Array.isArray(raw) ? raw[0] : raw;

  return <VerificadorClient initialHolder={holder ?? null} />;
}
