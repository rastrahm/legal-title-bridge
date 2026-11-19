import { OperadorClient } from "./OperadorClient";

function flag(sp: Record<string, string | string[] | undefined>, k: string): boolean {
  const v = sp[k];
  return Array.isArray(v) ? v[0] === "1" : v === "1";
}

/**
 * Operator route — forwards lab query flags as props (Playwright C16).
 */
export default async function OperadorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const chainRaw = sp.e2eChain;
  const chainStr = Array.isArray(chainRaw) ? chainRaw[0] : chainRaw;
  const e2eChain =
    chainStr != null && chainStr !== "" ? Number(chainStr) : null;

  return (
    <OperadorClient
      e2eChain={Number.isFinite(e2eChain) ? e2eChain : null}
      e2ePrepareIssue={flag(sp, "e2ePrepareIssue")}
    />
  );
}
