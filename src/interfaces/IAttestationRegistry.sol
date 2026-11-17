// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @title IAttestationRegistry
/// @notice Minimal attestation view used by TitleRegistry (full impl in ATTEST).
interface IAttestationRegistry {
    /// @notice True if the asset has a non-expired certification meeting quorum.
    function isCertified(bytes32 assetId) external view returns (bool);
}
