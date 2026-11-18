// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {CountryModule} from "../../src/compliance/CountryModule.sol";
import {LockupModule} from "../../src/compliance/LockupModule.sol";
import {MaxHoldersModule} from "../../src/compliance/MaxHoldersModule.sol";
import {AttestationRegistry} from "../../src/AttestationRegistry.sol";
import {RegistryErrors} from "../../src/errors/RegistryErrors.sol";
import {Assertion} from "../../src/interfaces/IIdentityRegistry.sol";
import {AttestationKind} from "../../src/interfaces/IAttestationRegistry.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {DecisionOutcome, ReasonCode, TitleRegistry} from "../../src/TitleRegistry.sol";
import {AttestationSig} from "../helpers/AttestationSig.sol";
import {IdentitySig} from "../helpers/IdentitySig.sol";

/// @title AttestationTitleTest
/// @notice ATTEST integration: issue/decide gated by real AttestationRegistry.
contract AttestationTitleTest is AttestationSig, IdentitySig {
    IdentityRegistry internal identity;
    AttestationRegistry internal attestation;
    TitleRegistry internal titles;

    address internal admin = makeAddr("admin");
    address internal issuer = makeAddr("issuer");
    address internal operator = makeAddr("operator");
    address internal court = makeAddr("court");
    address internal bridge = makeAddr("bridge");
    address internal complianceAdmin = makeAddr("complianceAdmin");

    uint256 internal verifierPk = 0xA11CE;
    uint256 internal c1Pk = 0xC01;
    uint256 internal c2Pk = 0xC02;
    address internal verifier;
    address internal c1;
    address internal c2;

    bytes32 internal assetId = keccak256("attest-title-lot");
    bytes32 internal seller = keccak256("seller-sol");
    bytes32 internal buyer = keccak256("buyer-sol");

    function setUp() public {
        verifier = vm.addr(verifierPk);
        c1 = vm.addr(c1Pk);
        c2 = vm.addr(c2Pk);

        identity = new IdentityRegistry(admin, verifier);

        address[] memory certs = new address[](2);
        certs[0] = c1;
        certs[1] = c2;
        attestation = new AttestationRegistry(admin, certs, 2);

        titles = new TitleRegistry(admin, issuer, operator, court, address(identity), address(attestation));

        CountryModule countryMod = new CountryModule(address(identity), complianceAdmin);
        MaxHoldersModule maxHolders = new MaxHoldersModule(address(titles), complianceAdmin);
        LockupModule lockup = new LockupModule(complianceAdmin);

        vm.startPrank(admin);
        titles.grantRole(titles.BRIDGE_ROLE(), bridge);
        titles.addComplianceModule(address(countryMod));
        titles.addComplianceModule(address(maxHolders));
        titles.addComplianceModule(address(lockup));
        vm.stopPrank();

        vm.prank(complianceAdmin);
        countryMod.setCountryAllowed(724, true);
        vm.prank(complianceAdmin);
        maxHolders.setMaxHolders(assetId, 10);

        _verify(seller);
        _verify(buyer);

        vm.prank(issuer);
        titles.createAsset(assetId);
    }

    function _verify(bytes32 holder) internal {
        Assertion memory a =
            Assertion({holder: holder, country: 724, investorType: 1, expiry: uint64(block.timestamp + 365 days)});
        identity.registerAssertion(a, signAssertion(identity, verifierPk, a));
    }

    function _certify(uint64 expiry) internal {
        _attestOne(c1Pk, AttestationKind.EXISTENCE, expiry);
        _attestOne(c1Pk, AttestationKind.REGISTRAL, expiry);
        _attestOne(c2Pk, AttestationKind.EXISTENCE, expiry);
        _attestOne(c2Pk, AttestationKind.REGISTRAL, expiry);
    }

    function _attestOne(uint256 pk, uint8 kind, uint64 expiry) internal {
        registryAttest(pk, kind, expiry);
    }

    function registryAttest(uint256 pk, uint8 kind, uint64 expiry) internal {
        attestation.attest(assetId, kind, expiry, signAttestation(attestation, pk, assetId, kind, expiry));
    }

    function test_IssueRevertsWithoutCertification() public {
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.CertificationExpired.selector, assetId));
        titles.issue(assetId, 10, seller);
    }

    function test_IssueSucceedsWithQuorum() public {
        _certify(uint64(block.timestamp + 30 days));
        vm.prank(issuer);
        titles.issue(assetId, 10, seller);
        assertEq(titles.balanceOf(assetId, seller), 10);
    }

    function test_DecideRejectedWhenCertExpired() public {
        uint64 exp = uint64(block.timestamp + 2 days);
        _certify(exp);
        vm.prank(issuer);
        titles.issue(assetId, 50, seller);

        bytes32 tid = keccak256("t-cert-exp");
        vm.prank(bridge);
        titles.onTransferRequest(tid, assetId, seller, buyer, 5, uint64(block.timestamp + 10 days));

        vm.warp(exp + 1);
        assertFalse(attestation.isCertified(assetId));

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Rejected));
        (,,,,,,, uint8 reason) = titles.requests(tid);
        assertEq(reason, ReasonCode.CERTIFICATION_EXPIRED);
        assertEq(titles.balanceOf(assetId, seller), 50);
    }

    function test_DecideApprovedWhileCertified() public {
        _certify(uint64(block.timestamp + 30 days));
        vm.prank(issuer);
        titles.issue(assetId, 50, seller);

        bytes32 tid = keccak256("t-ok");
        vm.prank(bridge);
        titles.onTransferRequest(tid, assetId, seller, buyer, 5, uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Approved));
        assertEq(titles.balanceOf(assetId, buyer), 5);
    }
}
