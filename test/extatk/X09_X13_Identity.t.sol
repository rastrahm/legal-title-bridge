// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

// EXTATK — X9–X13: Identity, attestation and title registry attacks.
// Independent attacker perspective; no reference to test/redteam/.
// Expected outcome for secure code: every attack reverts or returns Rejected (bloqueado).

import {AttestationRegistry} from "../../src/AttestationRegistry.sol";
import {Assertion, IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {AssetState, DecisionOutcome, TitleRegistry} from "../../src/TitleRegistry.sol";
import {RegistryErrors} from "../../src/errors/RegistryErrors.sol";
import {AttestationKind} from "../../src/interfaces/IAttestationRegistry.sol";
import {BridgePacketHelpers} from "../helpers/BridgePacketHelpers.sol";

/// @title X9–X13 Identity/Attestation/Title Attack Suite
contract X09_X13_IdentityTest is BridgePacketHelpers {
    // -------------------------------------------------------------------------
    // Fixture
    // -------------------------------------------------------------------------

    IdentityRegistry internal identity;
    AttestationRegistry internal attest;
    TitleRegistry internal titles;

    address internal admin = makeAddr("admin_x9");
    address internal verifier = makeAddr("verifier_x9");
    address internal issuer = makeAddr("issuer_x9");
    address internal operator = makeAddr("operator_x9");
    address internal court = makeAddr("court_x9");
    address internal attacker = makeAddr("attacker_x9");

    uint256 internal verifierPk = 0xFE01;
    uint256 internal cert1Pk = 0xFE02;
    uint256 internal cert2Pk = 0xFE03;

    bytes32 internal assetId = keccak256("asset-x9");
    bytes32 internal buyerKey = keccak256("buyer-x9");
    bytes32 internal sellerKey = keccak256("seller-x9");

    function setUp() public {
        // Deploy identity with dedicated verifier key (not admin).
        identity = new IdentityRegistry(admin, vm.addr(verifierPk));

        // Deploy attestation with cert1 + cert2, threshold 2.
        address[] memory certs = new address[](2);
        certs[0] = vm.addr(cert1Pk);
        certs[1] = vm.addr(cert2Pk);
        attest = new AttestationRegistry(admin, certs, 2);

        titles = new TitleRegistry(admin, issuer, operator, court, address(identity), address(attest));

        vm.prank(issuer);
        titles.createAsset(assetId);

        // Register sellerKey identity so issue() does not revert with NotVerified(seller).
        // The issue() call requires the target holder to be verified.
        _registerHolder(sellerKey, uint64(block.timestamp + 10 days));
    }

    // -------------------------------------------------------------------------
    // Helper: register a valid buyer assertion
    // -------------------------------------------------------------------------

    function _registerHolder(bytes32 holder, uint64 expiry) internal {
        Assertion memory a = Assertion({holder: holder, country: 724, investorType: 1, expiry: expiry});
        bytes32 digest = identity.hashAssertion(a);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierPk, digest);
        identity.registerAssertion(a, abi.encodePacked(r, s, v));
    }

    // -------------------------------------------------------------------------
    // Helper: certify asset with both certifiers
    // -------------------------------------------------------------------------

    function _certifyAsset(uint64 expiry) internal {
        for (uint256 i = 0; i < 2; i++) {
            uint256 pk = i == 0 ? cert1Pk : cert2Pk;

            bytes32 digest = attest.hashAttestation(assetId, AttestationKind.EXISTENCE, expiry);
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
            attest.attest(assetId, AttestationKind.EXISTENCE, expiry, abi.encodePacked(r, s, v));

            digest = attest.hashAttestation(assetId, AttestationKind.REGISTRAL, expiry);
            (v, r, s) = vm.sign(pk, digest);
            attest.attest(assetId, AttestationKind.REGISTRAL, expiry, abi.encodePacked(r, s, v));
        }
    }

    // -------------------------------------------------------------------------
    // Helper: inject a pending request directly (simulates BridgeEndpoint role).
    // -------------------------------------------------------------------------

    function _registerRequest(bytes32 transferId, uint256 amount, uint64 deadline) internal {
        vm.startPrank(admin);
        titles.grantRole(titles.BRIDGE_ROLE(), address(this));
        vm.stopPrank();
        titles.onTransferRequest(transferId, assetId, sellerKey, buyerKey, amount, deadline);
    }

    // -------------------------------------------------------------------------
    // X9 — EIP-712 assertion with wrong chainId / verifyingContract
    // -------------------------------------------------------------------------

    /// @notice Attacker replays an EIP-712 assertion signed under a fork chain (chainId=999).
    /// Step: construct the domain separator with chainId=999 (not the test chain), sign it.
    ///       The production IdentityRegistry uses the real chainId → digest mismatch → recovered
    ///       signer ≠ verifier → InvalidSignature.
    /// Verdict: bloqueado
    function test_X9_wrongChainIdAssertion_revertInvalidSignature() public {
        Assertion memory a =
            Assertion({holder: buyerKey, country: 724, investorType: 1, expiry: uint64(block.timestamp + 1 days)});

        // Build the EIP-712 digest for a fork with chainId=999.
        bytes32 typehash = keccak256("Assertion(bytes32 holder,uint16 country,uint8 investorType,uint64 expiry)");
        bytes32 structHash = keccak256(abi.encode(typehash, a.holder, a.country, a.investorType, a.expiry));
        bytes32 domainTypehash =
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
        bytes32 fakeDomain = keccak256(
            abi.encode(domainTypehash, keccak256("LegalTitleBridge"), keccak256("1"), uint256(999), address(identity))
        );
        bytes32 fakeDigest = keccak256(abi.encodePacked("\x19\x01", fakeDomain, structHash));

        // Verifier signs the wrong-domain digest (attacker scenario: stolen sig from fork).
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierPk, fakeDigest);

        vm.prank(attacker);
        vm.expectRevert(RegistryErrors.InvalidSignature.selector);
        identity.registerAssertion(a, abi.encodePacked(r, s, v));
    }

    // -------------------------------------------------------------------------
    // X10 — Certification expires between TRANSFER_REQUEST and decide()
    // -------------------------------------------------------------------------

    /// @notice Certification is live when request arrives, but expires before decide().
    /// Step:
    ///   1. Certify asset until t+100; register buyer identity; issue to seller.
    ///   2. Register TRANSFER_REQUEST (deadline t+200).
    ///   3. Warp past cert expiry (t+101).
    ///   4. decide() → Rejected, reasonCode=2 (CERTIFICATION_EXPIRED).
    /// Verdict: bloqueado
    function test_X10_certExpiredBeforeDecide_rejectWithCertExpired() public {
        uint64 certExpiry = uint64(block.timestamp + 100);
        uint64 idExpiry = uint64(block.timestamp + 200);

        _certifyAsset(certExpiry);
        _registerHolder(buyerKey, idExpiry);

        vm.prank(issuer);
        titles.issue(assetId, 500, sellerKey);

        bytes32 tid = keccak256("x10");
        _registerRequest(tid, 100, uint64(block.timestamp + 200));

        // Certification expired, but request deadline still future.
        vm.warp(block.timestamp + 101);

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Rejected), "expect Rejected");

        (,,,,,,, uint8 reason10) = titles.requests(tid);
        assertEq(reason10, 2, "reasonCode 2 = CERTIFICATION_EXPIRED");
    }

    // -------------------------------------------------------------------------
    // X11 — Buyer identity revoked after TRANSFER_REQUEST, before decide()
    // -------------------------------------------------------------------------

    /// @notice Verifier revokes buyer identity after request is Pending.
    ///         Operator calls decide() → must reject (NOT_VERIFIED = 1).
    /// Verdict: bloqueado
    function test_X11_buyerRevokedBeforeDecide_rejectNotVerified() public {
        uint64 expiry = uint64(block.timestamp + 1 days);

        _certifyAsset(expiry);
        _registerHolder(buyerKey, expiry);

        vm.prank(issuer);
        titles.issue(assetId, 500, sellerKey);

        bytes32 tid = keccak256("x11");
        _registerRequest(tid, 100, uint64(block.timestamp + 1 days));

        // Verifier revokes buyer (AML/compliance event).
        vm.prank(vm.addr(verifierPk));
        identity.revoke(buyerKey);
        assertFalse(identity.isVerified(buyerKey), "buyer unverified after revoke");

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Rejected));

        (,,,,,,, uint8 reason11) = titles.requests(tid);
        assertEq(reason11, 1, "reasonCode 1 = NOT_VERIFIED");
    }

    // -------------------------------------------------------------------------
    // X12 — Certifier signs twice, another doesn't sign
    // -------------------------------------------------------------------------

    /// @notice cert1 calls attest() twice (same address → overwrites); cert2 never attests.
    ///         quorumMet() must return false (1 out of 2 distinct certifiers → below threshold=2).
    ///         Attempting issue() → CertificationExpired.
    /// Verdict: bloqueado
    function test_X12_certifierDoubleSign_quorumNotMet() public {
        uint64 expiry = uint64(block.timestamp + 1 days);

        // cert1 attests EXISTENCE and REGISTRAL — calls attest() twice per kind.
        for (uint256 round = 0; round < 2; round++) {
            bytes32 digest = attest.hashAttestation(assetId, AttestationKind.EXISTENCE, expiry);
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(cert1Pk, digest);
            attest.attest(assetId, AttestationKind.EXISTENCE, expiry, abi.encodePacked(r, s, v));

            digest = attest.hashAttestation(assetId, AttestationKind.REGISTRAL, expiry);
            (v, r, s) = vm.sign(cert1Pk, digest);
            attest.attest(assetId, AttestationKind.REGISTRAL, expiry, abi.encodePacked(r, s, v));
        }

        // cert2 never attests → quorum not met (only 1 distinct certifier).
        assertFalse(attest.isCertified(assetId), "quorum must not be met with 1/2 certifiers");
        assertEq(attest.liveCount(assetId, AttestationKind.EXISTENCE), 1, "only cert1 live");

        // Any issue attempt must fail.
        _registerHolder(sellerKey, uint64(block.timestamp + 1 days));
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.CertificationExpired.selector, assetId));
        titles.issue(assetId, 100, sellerKey);
    }

    // -------------------------------------------------------------------------
    // X13 — Asset Frozen with Pending request → decide() rejects
    // -------------------------------------------------------------------------

    /// @notice Operator freezes asset after a DvP request is Pending.
    ///         decide() must reject with reasonCode=3 (ASSET_FROZEN).
    /// Verdict: bloqueado
    function test_X13_frozenAssetWithPendingRequest_rejectAssetFrozen() public {
        uint64 expiry = uint64(block.timestamp + 1 days);

        _certifyAsset(expiry);
        _registerHolder(buyerKey, expiry);

        vm.prank(issuer);
        titles.issue(assetId, 500, sellerKey);

        bytes32 tid = keccak256("x13");
        _registerRequest(tid, 100, uint64(block.timestamp + 1 days));

        // Regulatory freeze (operator or court).
        vm.prank(operator);
        titles.setAssetState(assetId, AssetState.Frozen);

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Rejected));

        (,,,,,,, uint8 reason13) = titles.requests(tid);
        assertEq(reason13, 3, "reasonCode 3 = ASSET_FROZEN");
    }

    // -------------------------------------------------------------------------
    // X13b — Asset Paused with Pending request → decide() rejects ASSET_NOT_ACTIVE
    // -------------------------------------------------------------------------

    function test_X13b_pausedAssetWithPendingRequest_rejectNotActive() public {
        uint64 expiry = uint64(block.timestamp + 1 days);

        _certifyAsset(expiry);
        _registerHolder(buyerKey, expiry);

        vm.prank(issuer);
        titles.issue(assetId, 500, sellerKey);

        bytes32 tid = keccak256("x13b");
        _registerRequest(tid, 100, uint64(block.timestamp + 1 days));

        vm.prank(operator);
        titles.setAssetState(assetId, AssetState.Paused);

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Rejected));

        (,,,,,,, uint8 reason13b) = titles.requests(tid);
        assertEq(reason13b, 4, "reasonCode 4 = ASSET_NOT_ACTIVE");
    }
}
