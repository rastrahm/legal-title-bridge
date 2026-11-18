// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @notice Certification kinds required for a certified asset (existencia + registral).
library AttestationKind {
    uint8 internal constant EXISTENCE = 0;
    uint8 internal constant REGISTRAL = 1;
}

/// @title IAttestationRegistry
/// @notice Asset certifications with expiry and certifier quorum (D13 / I7).
interface IAttestationRegistry {
    /// @notice True if both critical kinds meet quorum with non-expired attestations.
    function isCertified(bytes32 assetId) external view returns (bool);

    /// @notice True if both kinds currently meet the configured certifier threshold.
    function quorumMet(bytes32 assetId) external view returns (bool);

    /// @notice Register / refresh an EIP-712 attestation from a CERTIFIER_ROLE signer.
    /// @param assetId Asset identifier.
    /// @param kind AttestationKind.EXISTENCE or REGISTRAL.
    /// @param expiry Unix expiry (must be strictly in the future).
    /// @param signature EIP-712 signature by a certifier.
    function attest(bytes32 assetId, uint8 kind, uint64 expiry, bytes calldata signature) external;

    /// @notice Expiry recorded for `(assetId, kind, certifier)`, or 0 if none.
    function expiryOf(bytes32 assetId, uint8 kind, address certifier) external view returns (uint64);
}
