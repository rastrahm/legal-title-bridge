// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {BridgeErrors} from "../errors/BridgeErrors.sol";

/// @title RelayerQuorum
/// @notice Threshold checks and ECDSA quorum verification over a digest (D10 / D11).
library RelayerQuorum {
    /// @notice ⌈2n/3⌉ — minimum threshold for set size `n`.
    function minThreshold(uint256 n) internal pure returns (uint256) {
        return (2 * n + 2) / 3;
    }

    /// @notice Reverts unless `n >= 3` and `threshold >= ⌈2n/3⌉` and `threshold <= n` (I8 / R6).
    function requireThreshold(uint256 n, uint256 threshold) internal pure {
        if (n < 3 || threshold < minThreshold(n) || threshold > n) {
            revert BridgeErrors.ThresholdTooLow();
        }
    }

    /// @notice True if `account` appears in `set`.
    function isRelayer(address[] memory set, address account) internal pure returns (bool) {
        uint256 n = set.length;
        for (uint256 i; i < n; ++i) {
            if (set[i] == account) {
                return true;
            }
        }
        return false;
    }

    /// @notice Verifies at least `threshold` distinct set members signed `digest`.
    /// @dev Signatures must recover to strictly ascending addresses (no duplicates — X12 style).
    function verify(bytes32 digest, bytes[] memory signatures, address[] memory set, uint256 threshold)
        internal
        pure
        returns (bool)
    {
        if (threshold == 0 || signatures.length < threshold) {
            return false;
        }

        address prev = address(0);
        uint256 valid;
        uint256 sigLen = signatures.length;
        for (uint256 i; i < sigLen; ++i) {
            address signer = ECDSA.recover(digest, signatures[i]);
            if (signer == address(0) || !isRelayer(set, signer)) {
                return false;
            }
            if (uint160(signer) <= uint160(prev)) {
                return false; // unsorted or duplicate
            }
            prev = signer;
            unchecked {
                ++valid;
            }
        }
        return valid >= threshold;
    }

    /// @notice Like {verify} but reverts with InvalidQuorum on failure.
    function requireValid(bytes32 digest, bytes[] memory signatures, address[] memory set, uint256 threshold)
        internal
        pure
    {
        if (!verify(digest, signatures, set, threshold)) {
            revert BridgeErrors.InvalidQuorum();
        }
    }
}
