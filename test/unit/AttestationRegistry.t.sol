// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {AttestationRegistry} from "../../src/AttestationRegistry.sol";
import {RegistryErrors} from "../../src/errors/RegistryErrors.sol";
import {AttestationKind} from "../../src/interfaces/IAttestationRegistry.sol";
import {AttestationSig} from "../helpers/AttestationSig.sol";

contract AttestationRegistryTest is AttestationSig {
    AttestationRegistry internal registry;

    address internal admin = makeAddr("admin");
    uint256 internal c1Pk = 0xC01;
    uint256 internal c2Pk = 0xC02;
    uint256 internal c3Pk = 0xC03;
    address internal c1;
    address internal c2;
    address internal c3;

    bytes32 internal assetId = keccak256("lot-attest-1");

    function setUp() public {
        c1 = vm.addr(c1Pk);
        c2 = vm.addr(c2Pk);
        c3 = vm.addr(c3Pk);

        address[] memory certs = new address[](3);
        certs[0] = c1;
        certs[1] = c2;
        certs[2] = c3;
        registry = new AttestationRegistry(admin, certs, 2);
    }

    function _attestBoth(uint256 pk, uint64 expiry) internal {
        bytes32 aid = assetId;
        registry.attest(
            aid,
            AttestationKind.EXISTENCE,
            expiry,
            signAttestation(registry, pk, aid, AttestationKind.EXISTENCE, expiry)
        );
        registry.attest(
            aid,
            AttestationKind.REGISTRAL,
            expiry,
            signAttestation(registry, pk, aid, AttestationKind.REGISTRAL, expiry)
        );
    }

    function test_QuorumRequiresBothKindsAndThreshold() public {
        uint64 exp = uint64(block.timestamp + 30 days);
        assertFalse(registry.isCertified(assetId));

        _attestBoth(c1Pk, exp);
        assertFalse(registry.quorumMet(assetId)); // only 1 of 2

        _attestBoth(c2Pk, exp);
        assertTrue(registry.isCertified(assetId));
        assertEq(registry.liveCount(assetId, AttestationKind.EXISTENCE), 2);
    }

    function test_DoubleAttestSameCertifierCountsOnce() public {
        uint64 exp = uint64(block.timestamp + 30 days);
        _attestBoth(c1Pk, exp);
        // refresh same certifier — still one live address (X12)
        _attestBoth(c1Pk, uint64(block.timestamp + 60 days));
        assertEq(registry.liveCount(assetId, AttestationKind.EXISTENCE), 1);
        assertFalse(registry.quorumMet(assetId));
    }

    function test_ExpiryLapseDropsCertification() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        _attestBoth(c1Pk, exp);
        _attestBoth(c2Pk, exp);
        assertTrue(registry.isCertified(assetId));

        vm.warp(exp + 1);
        assertFalse(registry.isCertified(assetId));
        assertEq(registry.liveCount(assetId, AttestationKind.EXISTENCE), 0);
    }

    function test_RevertExpiredOnAttest() public {
        uint64 exp = uint64(block.timestamp);
        bytes memory sig = signAttestation(registry, c1Pk, assetId, AttestationKind.EXISTENCE, exp);
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.AttestationExpired.selector, assetId));
        registry.attest(assetId, AttestationKind.EXISTENCE, exp, sig);
    }

    function test_RevertInvalidKind() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        bytes memory sig = signAttestation(registry, c1Pk, assetId, 9, exp);
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.InvalidKind.selector, uint8(9)));
        registry.attest(assetId, 9, exp, sig);
    }

    function test_RevertInvalidSignature() public {
        uint64 exp = uint64(block.timestamp + 1 days);
        uint256 stranger = 0xBEEF;
        bytes memory sig = signAttestation(registry, stranger, assetId, AttestationKind.EXISTENCE, exp);
        vm.expectRevert(RegistryErrors.InvalidSignature.selector);
        registry.attest(assetId, AttestationKind.EXISTENCE, exp, sig);
    }

    function test_RevertRoleOverlapOnDeploy() public {
        address[] memory certs = new address[](1);
        certs[0] = admin;
        vm.expectRevert(
            abi.encodeWithSelector(RegistryErrors.RoleOverlap.selector, bytes32(0), keccak256("CERTIFIER_ROLE"))
        );
        new AttestationRegistry(admin, certs, 1);
    }

    function test_RevertDuplicateCertifierOnDeploy() public {
        address[] memory certs = new address[](2);
        certs[0] = c1;
        certs[1] = c1;
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.DuplicateCertifier.selector, c1));
        new AttestationRegistry(admin, certs, 1);
    }

    function test_RevertThresholdInvalid() public {
        address[] memory certs = new address[](2);
        certs[0] = c1;
        certs[1] = c2;
        vm.expectRevert(RegistryErrors.ThresholdInvalid.selector);
        new AttestationRegistry(admin, certs, 3);
    }

    function test_AddCertifierAndSetThreshold() public {
        address c4 = makeAddr("c4");
        vm.prank(admin);
        registry.addCertifier(c4);
        assertEq(registry.certifierCount(), 4);

        vm.prank(admin);
        registry.setThreshold(3);
        assertEq(registry.threshold(), 3);

        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(RegistryErrors.RoleOverlap.selector, bytes32(0), keccak256("CERTIFIER_ROLE"))
        );
        registry.addCertifier(admin);
    }

    function testFuzz_LiveCountUnique(uint8 which) public {
        which = uint8(bound(which, 0, 2));
        uint64 exp = uint64(block.timestamp + 10 days);
        uint256 pk = which == 0 ? c1Pk : (which == 1 ? c2Pk : c3Pk);
        _attestBoth(pk, exp);
        assertEq(registry.liveCount(assetId, AttestationKind.EXISTENCE), 1);
        assertEq(registry.expiryOf(assetId, AttestationKind.EXISTENCE, vm.addr(pk)), exp);
    }
}
