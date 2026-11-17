// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @title RegistryErrors
/// @notice Custom errors for identity, title registry and compliance.
library RegistryErrors {
    error ZeroAddress();
    error ZeroAmount();
    error Unauthorized();
    error NotVerified(bytes32 holder);
    error TransferNotCompliant(uint8 rule);
    error CertificationExpired(bytes32 assetId);
    error AssetFrozen(bytes32 assetId);
    error AssetNotActive(bytes32 assetId);
    error AssetUnknown(bytes32 assetId);
    error InsufficientBalance(bytes32 assetId, bytes32 holder);
    error RequestNotPending(bytes32 transferId);
    error RequestAlreadyExists(bytes32 transferId);
    error DeadlinePassed(bytes32 transferId);
    error InvalidSignature();
    error AssertionExpired(bytes32 holder);
    error AssertionMissing(bytes32 holder);
    error RoleOverlap(bytes32 roleA, bytes32 roleB);
    error InvalidCountry();
    error LockupActive(bytes32 holder);
}
