// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @notice Verifier assertion bound to a Solana holder key (D2).
struct Assertion {
    bytes32 holder;
    uint16 country;
    uint8 investorType;
    uint64 expiry;
}

/// @title IIdentityRegistry
/// @notice EIP-712 identity assertions keyed by Solana pubkey.
interface IIdentityRegistry {
    function isVerified(bytes32 holder) external view returns (bool);
    function getAssertion(bytes32 holder) external view returns (Assertion memory);
    function registerAssertion(Assertion calldata assertion, bytes calldata signature) external;
    function revoke(bytes32 holder) external;
}
