// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test} from "forge-std/Test.sol";

import {AttestationRegistry} from "../../src/AttestationRegistry.sol";

/// @title AttestationSig
/// @notice EIP-712 signing helpers for AttestationRegistry tests.
abstract contract AttestationSig is Test {
    function signAttestation(
        AttestationRegistry registry,
        uint256 certifierPk,
        bytes32 assetId,
        uint8 kind,
        uint64 expiry
    ) internal view returns (bytes memory signature) {
        bytes32 digest = registry.hashAttestation(assetId, kind, expiry);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(certifierPk, digest);
        signature = abi.encodePacked(r, s, v);
    }
}
