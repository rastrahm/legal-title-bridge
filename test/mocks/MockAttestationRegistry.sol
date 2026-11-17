// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IAttestationRegistry} from "../../src/interfaces/IAttestationRegistry.sol";

/// @title MockAttestationRegistry
/// @notice TITLE-phase stub; full AttestationRegistry lands in ATTEST.
contract MockAttestationRegistry is IAttestationRegistry {
    mapping(bytes32 assetId => bool certified) public certified;

    function setCertified(bytes32 assetId, bool value) external {
        certified[assetId] = value;
    }

    function isCertified(bytes32 assetId) external view returns (bool) {
        return certified[assetId];
    }
}
