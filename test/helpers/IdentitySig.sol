// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test} from "forge-std/Test.sol";

import {Assertion} from "../../src/interfaces/IIdentityRegistry.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";

/// @title IdentitySig
/// @notice EIP-712 signing helpers for IdentityRegistry tests.
abstract contract IdentitySig is Test {
    function signAssertion(IdentityRegistry registry, uint256 verifierPk, Assertion memory assertion)
        internal
        view
        returns (bytes memory signature)
    {
        bytes32 digest = registry.hashAssertion(assertion);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierPk, digest);
        signature = abi.encodePacked(r, s, v);
    }
}
