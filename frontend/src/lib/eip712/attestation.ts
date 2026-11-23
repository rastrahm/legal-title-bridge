/**
 * EIP-712 Attestation typed data for AttestationRegistry.
 */

export interface AttestationFields {
  assetId: string;
  kind: number; // 0 EXISTENCE, 1 REGISTRAL
  expiry: number;
}

export interface AttestationTypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: {
    Attestation: Array<{ name: string; type: string }>;
  };
  primaryType: "Attestation";
  message: {
    assetId: string;
    kind: number;
    expiry: number;
  };
}

/**
 * Build EIP-712 payload matching AttestationRegistry ATTESTATION_TYPEHASH.
 */
export function buildAttestationTypedData(
  verifyingContract: string,
  chainId: number,
  fields: AttestationFields,
): AttestationTypedData {
  return {
    domain: {
      name: "LegalTitleBridge",
      version: "1",
      chainId,
      verifyingContract,
    },
    types: {
      Attestation: [
        { name: "assetId", type: "bytes32" },
        { name: "kind", type: "uint8" },
        { name: "expiry", type: "uint64" },
      ],
    },
    primaryType: "Attestation",
    message: {
      assetId: fields.assetId,
      kind: fields.kind,
      expiry: fields.expiry,
    },
  };
}
