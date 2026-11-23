/**
 * Decode TitleRegistry / attestation custom errors from ethers CALL_EXCEPTION data.
 */

import { Interface } from "ethers";

const ERROR_IFACE = new Interface([
  "error ZeroAddress()",
  "error ZeroAmount()",
  "error Unauthorized()",
  "error NotVerified(bytes32 holder)",
  "error TransferNotCompliant(uint8 rule)",
  "error CertificationExpired(bytes32 assetId)",
  "error AssetFrozen(bytes32 assetId)",
  "error AssetNotActive(bytes32 assetId)",
  "error AssetUnknown(bytes32 assetId)",
  "error InsufficientBalance(bytes32 assetId, bytes32 holder)",
  "error InvalidSignature()",
  "error AssertionExpired(bytes32 holder)",
  "error AssertionMissing(bytes32 holder)",
  "error AttestationExpired(bytes32 assetId)",
  "error InvalidKind(uint8 kind)",
  "error ThresholdInvalid()",
  "error DuplicateCertifier(address certifier)",
]);

/** Friendly labels for common registry reverts (lab UI). */
const LABELS: Record<string, string> = {
  AssetNotActive:
    "AssetNotActive: el lote no está Active (falta createAsset, o está pausado/congelado).",
  AssetUnknown: "AssetUnknown: el assetId no existe on-chain.",
  AssetFrozen: "AssetFrozen: el lote está congelado.",
  CertificationExpired:
    "CertificationExpired: falta quórum de certificaciones (existencia + registral) o están vencidas.",
  NotVerified: "NotVerified: el holder destinatario no tiene KYC vigente.",
  ZeroAmount: "ZeroAmount: el monto debe ser > 0.",
  ZeroAddress: "ZeroAddress: assetId o holder cero no válidos.",
  Unauthorized: "Unauthorized: la cuenta no tiene el rol requerido.",
  InvalidSignature: "InvalidSignature: firma EIP-712 inválida o sin rol.",
  AttestationExpired: "AttestationExpired: expiry de la certificación ya pasó.",
};

/**
 * Extract a short human message from a wallet / eth_call failure.
 */
export function formatRegistryError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const dataMatch = /data="(0x[0-9a-fA-F]+)"/.exec(raw);
  const data =
    dataMatch?.[1] ??
    (typeof err === "object" &&
    err !== null &&
    "data" in err &&
    typeof (err as { data: unknown }).data === "string"
      ? (err as { data: string }).data
      : null);

  if (data && data.length >= 10) {
    try {
      const parsed = ERROR_IFACE.parseError(data);
      if (parsed) {
        const label = LABELS[parsed.name] ?? parsed.name;
        const args = parsed.args.length
          ? ` · ${parsed.args.map((a) => String(a)).join(", ")}`
          : "";
        return `${label}${args}`;
      }
    } catch {
      // fall through
    }
  }

  if (raw.includes("AssetNotActive") || raw.includes("0xf558e2db")) {
    return LABELS.AssetNotActive;
  }
  if (raw.includes("CertificationExpired") || raw.includes("0x1747fddf")) {
    return LABELS.CertificationExpired;
  }
  if (raw.includes("NotVerified") || raw.includes("0xc2f4d617")) {
    return LABELS.NotVerified;
  }
  return raw;
}
