// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IAttestationRegistry} from "../../src/interfaces/IAttestationRegistry.sol";

/// @title MockAttestationRegistry
/// @notice TITLE-phase stub; production path uses AttestationRegistry.
contract MockAttestationRegistry is IAttestationRegistry {
    mapping(bytes32 assetId => bool certified) public certified;

    function setCertified(bytes32 assetId, bool value) external {
        certified[assetId] = value;
    }

    function isCertified(bytes32 assetId) external view returns (bool) {
        return certified[assetId];
    }

    function quorumMet(bytes32 assetId) external view returns (bool) {
        return certified[assetId];
    }

    function attest(bytes32, uint8, uint64, bytes calldata) external pure {
        // no-op stub
    }

    function expiryOf(bytes32, uint8, address) external pure returns (uint64) {
        return 0;
    }
}
