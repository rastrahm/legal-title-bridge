/**
 * EIP-712 Assertion typed data for IdentityRegistry (LegalTitleBridge / 1).
 */

export interface AssertionFields {
  holder: string; // bytes32 hex
  country: number; // uint16 ISO numeric
  investorType: number; // uint8
  expiry: number; // uint64 unix
}

export interface AssertionTypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: {
    Assertion: Array<{ name: string; type: string }>;
  };
  primaryType: "Assertion";
  message: {
    holder: string;
    country: number;
    investorType: number;
    expiry: number;
  };
}

/**
 * Build EIP-712 payload matching IdentityRegistry ASSERTION_TYPEHASH.
 */
export function buildAssertionTypedData(
  verifyingContract: string,
  chainId: number,
  assertion: AssertionFields,
): AssertionTypedData {
  return {
    domain: {
      name: "LegalTitleBridge",
      version: "1",
      chainId,
      verifyingContract,
    },
    types: {
      Assertion: [
        { name: "holder", type: "bytes32" },
        { name: "country", type: "uint16" },
        { name: "investorType", type: "uint8" },
        { name: "expiry", type: "uint64" },
      ],
    },
    primaryType: "Assertion",
    message: {
      holder: assertion.holder,
      country: assertion.country,
      investorType: assertion.investorType,
      expiry: assertion.expiry,
    },
  };
}
