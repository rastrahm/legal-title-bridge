import { PuenteClient } from "./PuenteClient";

/**
 * Bridge monitor route — forwards lab query flags as props.
 */
export default async function PuentePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = sp.e2eFakeRelayer;
  const e2eFakeRelayer = Array.isArray(raw) ? raw[0] === "1" : raw === "1";
  return <PuenteClient e2eFakeRelayer={e2eFakeRelayer} />;
}
