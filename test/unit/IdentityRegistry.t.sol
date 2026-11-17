// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Assertion} from "../../src/interfaces/IIdentityRegistry.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {RegistryErrors} from "../../src/errors/RegistryErrors.sol";
import {IdentitySig} from "../helpers/IdentitySig.sol";

contract IdentityRegistryTest is IdentitySig {
    IdentityRegistry internal registry;

    address internal admin = makeAddr("admin");
    uint256 internal verifierPk = 0xA11CE;
    address internal verifier;

    bytes32 internal holder = keccak256("holder-solana");

    function setUp() public {
        verifier = vm.addr(verifierPk);
        registry = new IdentityRegistry(admin, verifier);
    }

    function _assertion(uint64 expiry) internal view returns (Assertion memory) {
        return Assertion({holder: holder, country: 724, investorType: 1, expiry: expiry});
    }

    function test_RegisterAndIsVerified() public {
        Assertion memory a = _assertion(uint64(block.timestamp + 30 days));
        bytes memory sig = signAssertion(registry, verifierPk, a);
        registry.registerAssertion(a, sig);
        assertTrue(registry.isVerified(holder));
        Assertion memory stored = registry.getAssertion(holder);
        assertEq(stored.country, 724);
    }

    function test_RevertExpiredAssertion() public {
        Assertion memory a = _assertion(uint64(block.timestamp));
        bytes memory sig = signAssertion(registry, verifierPk, a);
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.AssertionExpired.selector, holder));
        registry.registerAssertion(a, sig);
    }

    function test_RevertInvalidSignature() public {
        Assertion memory a = _assertion(uint64(block.timestamp + 1 days));
        uint256 strangerPk = 0xB0B;
        bytes memory sig = signAssertion(registry, strangerPk, a);
        vm.expectRevert(RegistryErrors.InvalidSignature.selector);
        registry.registerAssertion(a, sig);
    }

    function test_Revoke() public {
        Assertion memory a = _assertion(uint64(block.timestamp + 30 days));
        registry.registerAssertion(a, signAssertion(registry, verifierPk, a));
        vm.prank(verifier);
        registry.revoke(holder);
        assertFalse(registry.isVerified(holder));
    }

    function test_ExpiryLapse() public {
        Assertion memory a = _assertion(uint64(block.timestamp + 1 days));
        registry.registerAssertion(a, signAssertion(registry, verifierPk, a));
        vm.warp(block.timestamp + 2 days);
        assertFalse(registry.isVerified(holder));
    }

    function test_RevertRoleOverlapOnDeploy() public {
        vm.expectRevert(
            abi.encodeWithSelector(RegistryErrors.RoleOverlap.selector, bytes32(0), keccak256("VERIFIER_ROLE"))
        );
        // DEFAULT_ADMIN_ROLE is 0x00
        new IdentityRegistry(verifier, verifier);
    }

    function testFuzz_Register(uint16 country, uint8 investorType, uint64 ttl) public {
        ttl = uint64(bound(ttl, 1, 365 days));
        bytes32 h = keccak256(abi.encode(country, investorType, ttl));
        Assertion memory a =
            Assertion({holder: h, country: country, investorType: investorType, expiry: uint64(block.timestamp + ttl)});
        registry.registerAssertion(a, signAssertion(registry, verifierPk, a));
        assertTrue(registry.isVerified(h));
    }
}
