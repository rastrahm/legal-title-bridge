// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

// EXTATK — X20–X21: Reconciliation replay and zero-hash attacks on TitleRegistry.
// Expected outcome for secure code: reverts (bloqueado).

import {AttestationRegistry} from "../../src/AttestationRegistry.sol";
import {Assertion, IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {DecisionOutcome, RequestStatus, TitleRegistry} from "../../src/TitleRegistry.sol";
import {RegistryErrors} from "../../src/errors/RegistryErrors.sol";
import {AttestationKind} from "../../src/interfaces/IAttestationRegistry.sol";
import {BridgePacketHelpers} from "../helpers/BridgePacketHelpers.sol";

/// @title X20–X21 Reconciliation Attack Suite
contract X20_X21_ReconcileTest is BridgePacketHelpers {
    IdentityRegistry internal identity;
    AttestationRegistry internal attest;
    TitleRegistry internal titles;

    address internal admin = makeAddr("admin_x20");
    address internal issuer = makeAddr("issuer_x20");
    address internal operator = makeAddr("operator_x20");
    address internal court = makeAddr("court_x20");

    uint256 internal verifierPk = 0xFE11;
    uint256 internal cert1Pk = 0xFE12;
    uint256 internal cert2Pk = 0xFE13;

    bytes32 internal assetId = keccak256("asset-x20");
    bytes32 internal buyerKey = keccak256("buyer-x20");
    bytes32 internal sellerKey = keccak256("seller-x20");

    function setUp() public {
        identity = new IdentityRegistry(admin, vm.addr(verifierPk));

        address[] memory certs = new address[](2);
        certs[0] = vm.addr(cert1Pk);
        certs[1] = vm.addr(cert2Pk);
        attest = new AttestationRegistry(admin, certs, 2);

        titles = new TitleRegistry(admin, issuer, operator, court, address(identity), address(attest));

        // Full setup: certify, issue, register buyer.
        uint64 exp = uint64(block.timestamp + 1 days);
        for (uint256 i = 0; i < 2; i++) {
            uint256 pk = i == 0 ? cert1Pk : cert2Pk;
            bytes32 d = attest.hashAttestation(assetId, AttestationKind.EXISTENCE, exp);
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, d);
            attest.attest(assetId, AttestationKind.EXISTENCE, exp, abi.encodePacked(r, s, v));
            d = attest.hashAttestation(assetId, AttestationKind.REGISTRAL, exp);
            (v, r, s) = vm.sign(pk, d);
            attest.attest(assetId, AttestationKind.REGISTRAL, exp, abi.encodePacked(r, s, v));
        }

        vm.prank(issuer);
        titles.createAsset(assetId);

        // Register sellerKey identity (issue() requires holder to be verified).
        {
            Assertion memory sa = Assertion({holder: sellerKey, country: 724, investorType: 1, expiry: exp});
            bytes32 sd = identity.hashAssertion(sa);
            (uint8 sv, bytes32 sr, bytes32 ss) = vm.sign(verifierPk, sd);
            identity.registerAssertion(sa, abi.encodePacked(sr, ss, sv));
        }

        // Register buyerKey identity (decide() requires buyer to be verified).
        {
            Assertion memory a = Assertion({holder: buyerKey, country: 724, investorType: 1, expiry: exp});
            bytes32 d = identity.hashAssertion(a);
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierPk, d);
            identity.registerAssertion(a, abi.encodePacked(r, s, v));
        }

        vm.prank(issuer);
        titles.issue(assetId, 1000, sellerKey);
    }

    // -------------------------------------------------------------------------
    // Helper: inject approved transfer
    // -------------------------------------------------------------------------

    function _makeApproved(bytes32 tid) internal {
        vm.startPrank(admin);
        titles.grantRole(titles.BRIDGE_ROLE(), address(this));
        vm.stopPrank();

        titles.onTransferRequest(tid, assetId, sellerKey, buyerKey, 100, uint64(block.timestamp + 1 days));

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Approved), "pre-condition: Approved");
    }

    // -------------------------------------------------------------------------
    // X20 — Reconcile same transferId twice with same resolutionHash
    // -------------------------------------------------------------------------

    /// @notice Attacker (compromised operator) calls reconcile() twice on the same transferId.
    ///         The second call must revert because the request status is now Reconciled (not Approved).
    /// Step:
    ///   1. Drive request to Approved.
    ///   2. Reconcile once (D6 undo).
    ///   3. Reconcile again with same hash → RequestNotApproved revert.
    /// Verdict: bloqueado
    function test_X20_doubleReconcile_revertRequestNotApproved() public {
        bytes32 tid = keccak256("x20");
        _makeApproved(tid);

        bytes32 resolutionHash = keccak256("resolution-x20");

        // First reconcile: OK.
        vm.prank(operator);
        titles.reconcile(tid, resolutionHash);

        (,,,,,, RequestStatus status20,) = titles.requests(tid);
        assertEq(uint8(status20), uint8(RequestStatus.Reconciled), "status = Reconciled after first reconcile");

        // Second reconcile with same hash must fail.
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.RequestNotApproved.selector, tid));
        titles.reconcile(tid, resolutionHash);
    }

    // -------------------------------------------------------------------------
    // X21 — Reconcile with zero / empty resolutionHash
    // -------------------------------------------------------------------------

    /// @notice Attacker submits reconcile with bytes32(0) as resolutionHash — no anchor.
    ///         Must revert: ZeroAddress (guard against invented reconciliation).
    /// Verdict: bloqueado
    function test_X21_reconcileZeroHash_revertZeroAddress() public {
        bytes32 tid = keccak256("x21");
        _makeApproved(tid);

        vm.prank(operator);
        vm.expectRevert(RegistryErrors.ZeroAddress.selector);
        titles.reconcile(tid, bytes32(0));
    }

    // -------------------------------------------------------------------------
    // X21b — Reconcile non-Approved request (e.g. Pending)
    // -------------------------------------------------------------------------

    function test_X21b_reconcilePendingRequest_revertRequestNotApproved() public {
        vm.startPrank(admin);
        titles.grantRole(titles.BRIDGE_ROLE(), address(this));
        vm.stopPrank();

        bytes32 tid = keccak256("x21b");
        titles.onTransferRequest(tid, assetId, sellerKey, buyerKey, 50, uint64(block.timestamp + 1 days));

        (,,,,,, RequestStatus status21b,) = titles.requests(tid);
        assertEq(uint8(status21b), uint8(RequestStatus.Pending));

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.RequestNotApproved.selector, tid));
        titles.reconcile(tid, keccak256("some-hash"));
    }
}
