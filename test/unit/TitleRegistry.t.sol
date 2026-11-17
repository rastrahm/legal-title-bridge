// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {CountryModule} from "../../src/compliance/CountryModule.sol";
import {LockupModule} from "../../src/compliance/LockupModule.sol";
import {MaxHoldersModule} from "../../src/compliance/MaxHoldersModule.sol";
import {RegistryErrors} from "../../src/errors/RegistryErrors.sol";
import {Assertion} from "../../src/interfaces/IIdentityRegistry.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {AssetState, DecisionOutcome, ReasonCode, TitleRegistry} from "../../src/TitleRegistry.sol";
import {IdentitySig} from "../helpers/IdentitySig.sol";
import {MockAttestationRegistry} from "../mocks/MockAttestationRegistry.sol";

contract TitleRegistryTest is IdentitySig {
    IdentityRegistry internal identity;
    MockAttestationRegistry internal attestation;
    TitleRegistry internal titles;
    CountryModule internal countryMod;
    MaxHoldersModule internal maxHolders;
    LockupModule internal lockup;

    address internal admin = makeAddr("admin");
    address internal issuer = makeAddr("issuer");
    address internal operator = makeAddr("operator");
    address internal court = makeAddr("court");
    address internal bridge = makeAddr("bridge");
    address internal complianceAdmin = makeAddr("complianceAdmin");

    uint256 internal verifierPk = 0xA11CE;
    address internal verifier;

    bytes32 internal assetId = keccak256("lot-2026-01");
    bytes32 internal seller = keccak256("seller-sol");
    bytes32 internal buyer = keccak256("buyer-sol");
    bytes32 internal buyer2 = keccak256("buyer2-sol");

    uint16 internal constant COUNTRY_ES = 724;
    uint16 internal constant COUNTRY_US = 840;

    function setUp() public {
        verifier = vm.addr(verifierPk);
        identity = new IdentityRegistry(admin, verifier);
        attestation = new MockAttestationRegistry();

        titles = new TitleRegistry(admin, issuer, operator, court, address(identity), address(attestation));

        countryMod = new CountryModule(address(identity), complianceAdmin);
        maxHolders = new MaxHoldersModule(address(titles), complianceAdmin);
        lockup = new LockupModule(complianceAdmin);

        vm.startPrank(admin);
        titles.grantRole(titles.BRIDGE_ROLE(), bridge);
        titles.addComplianceModule(address(countryMod));
        titles.addComplianceModule(address(maxHolders));
        titles.addComplianceModule(address(lockup));
        vm.stopPrank();

        vm.prank(complianceAdmin);
        countryMod.setCountryAllowed(COUNTRY_ES, true);

        vm.prank(complianceAdmin);
        maxHolders.setMaxHolders(assetId, 10);

        _verify(seller, COUNTRY_ES);
        _verify(buyer, COUNTRY_ES);
        _verify(buyer2, COUNTRY_ES);

        attestation.setCertified(assetId, true);

        vm.prank(issuer);
        titles.createAsset(assetId);
    }

    function _verify(bytes32 holder, uint16 country) internal {
        Assertion memory a =
            Assertion({holder: holder, country: country, investorType: 1, expiry: uint64(block.timestamp + 365 days)});
        identity.registerAssertion(a, signAssertion(identity, verifierPk, a));
    }

    function _issue(uint256 amount, bytes32 to) internal {
        vm.prank(issuer);
        titles.issue(assetId, amount, to);
    }

    function _request(bytes32 transferId, bytes32 from, bytes32 to, uint256 amount, uint64 deadline) internal {
        vm.prank(bridge);
        titles.onTransferRequest(transferId, assetId, from, to, amount, deadline);
    }

    function test_IssueCreditsBalanceAndLedger() public {
        _issue(100, seller);
        assertEq(titles.balanceOf(assetId, seller), 100);
        assertEq(titles.totalIssued(assetId), 100);
        assertEq(titles.circulating(assetId), 100);
        assertEq(titles.entryCount(assetId), 1);
        assertTrue(titles.verifyLedger(assetId));
    }

    function test_RevertIssueWithoutCertification() public {
        attestation.setCertified(assetId, false);
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.CertificationExpired.selector, assetId));
        titles.issue(assetId, 1, seller);
    }

    function test_RevertIssueUnverifiedHolder() public {
        bytes32 ghost = keccak256("ghost");
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.NotVerified.selector, ghost));
        titles.issue(assetId, 1, ghost);
    }

    function test_DecideApprovedMovesBalance() public {
        _issue(50, seller);
        bytes32 tid = keccak256("t1");
        _request(tid, seller, buyer, 20, uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Approved));
        assertEq(titles.balanceOf(assetId, seller), 30);
        assertEq(titles.balanceOf(assetId, buyer), 20);
        assertTrue(titles.verifyLedger(assetId));
    }

    function test_DecideRejectedNotVerified() public {
        _issue(50, seller);
        bytes32 ghost = keccak256("ghost-buyer");
        bytes32 tid = keccak256("t-nv");
        _request(tid, seller, ghost, 10, uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Rejected));
        (,,,,,,, uint8 reason) = titles.requests(tid);
        assertEq(reason, ReasonCode.NOT_VERIFIED);
        assertEq(titles.balanceOf(assetId, seller), 50);
    }

    function test_DecideRejectedCountry() public {
        _issue(50, seller);
        bytes32 usBuyer = keccak256("us-buyer");
        _verify(usBuyer, COUNTRY_US);
        bytes32 tid = keccak256("t-country");
        _request(tid, seller, usBuyer, 5, uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Rejected));
        (,,,,,,, uint8 reason) = titles.requests(tid);
        assertEq(reason, countryMod.RULE_ID());
    }

    function test_DecideRejectedMaxHolders() public {
        vm.prank(complianceAdmin);
        maxHolders.setMaxHolders(assetId, 1); // only seller after issue

        _issue(50, seller);
        bytes32 tid = keccak256("t-max");
        _request(tid, seller, buyer, 5, uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Rejected));
        (,,,,,,, uint8 reason) = titles.requests(tid);
        assertEq(reason, maxHolders.RULE_ID());
    }

    function test_DecideRejectedLockup() public {
        _issue(50, seller);
        vm.prank(complianceAdmin);
        lockup.setLockup(assetId, seller, uint64(block.timestamp + 7 days));

        bytes32 tid = keccak256("t-lock");
        _request(tid, seller, buyer, 5, uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Rejected));
        (,,,,,,, uint8 reason) = titles.requests(tid);
        assertEq(reason, lockup.RULE_ID());
    }

    function test_DecideExpiredAfterDeadline() public {
        _issue(50, seller);
        bytes32 tid = keccak256("t-exp");
        uint64 deadline = uint64(block.timestamp + 10);
        _request(tid, seller, buyer, 5, deadline);
        vm.warp(deadline + 1);

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Expired));
        assertEq(titles.balanceOf(assetId, seller), 50);
    }

    function test_DecideRejectedCertExpired() public {
        _issue(50, seller);
        attestation.setCertified(assetId, false);
        bytes32 tid = keccak256("t-cert");
        _request(tid, seller, buyer, 5, uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Rejected));
        (,,,,,,, uint8 reason) = titles.requests(tid);
        assertEq(reason, ReasonCode.CERTIFICATION_EXPIRED);
    }

    function test_PauseBlocksApproval() public {
        _issue(50, seller);
        vm.prank(operator);
        titles.setAssetState(assetId, AssetState.Paused);

        bytes32 tid = keccak256("t-pause");
        _request(tid, seller, buyer, 5, uint64(block.timestamp + 1 hours));
        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Rejected));
        (,,,,,,, uint8 reason) = titles.requests(tid);
        assertEq(reason, ReasonCode.ASSET_NOT_ACTIVE);
    }

    function test_ForcedTransfer() public {
        _issue(40, seller);
        vm.prank(court);
        titles.forcedTransfer(assetId, seller, buyer, 15, keccak256("court-res-1"));
        assertEq(titles.balanceOf(assetId, seller), 25);
        assertEq(titles.balanceOf(assetId, buyer), 15);
        assertTrue(titles.verifyLedger(assetId));
    }

    function test_ReconcileReversesApproved() public {
        _issue(50, seller);
        bytes32 tid = keccak256("t-rec");
        _request(tid, seller, buyer, 20, uint64(block.timestamp + 1 hours));
        vm.prank(operator);
        titles.decide(tid);

        vm.prank(operator);
        titles.reconcile(tid, keccak256("d6-res"));
        assertEq(titles.balanceOf(assetId, seller), 50);
        assertEq(titles.balanceOf(assetId, buyer), 0);
    }

    function test_RedeemInKind() public {
        _issue(30, seller);
        vm.prank(court);
        titles.redeemInKind(assetId, seller, 10);
        assertEq(titles.balanceOf(assetId, seller), 20);
        assertEq(titles.totalRedeemed(assetId), 10);
        assertEq(titles.circulating(assetId), 20);
    }

    function test_LedgerChainMultipleEntries() public {
        _issue(10, seller);
        _issue(5, buyer);
        vm.prank(court);
        titles.forcedTransfer(assetId, seller, buyer2, 3, keccak256("r"));
        assertEq(titles.entryCount(assetId), 3);
        assertTrue(titles.verifyLedger(assetId));
    }

    function testFuzz_IssueMaintainsI1(uint128 a, uint128 b) public {
        uint256 x = bound(a, 1, type(uint128).max / 2);
        uint256 y = bound(b, 1, type(uint128).max / 2);
        _issue(x, seller);
        _issue(y, buyer);
        assertEq(titles.balanceOf(assetId, seller) + titles.balanceOf(assetId, buyer), titles.circulating(assetId));
    }

    function test_ConstructorRevertsZeroAndOverlap() public {
        vm.expectRevert(RegistryErrors.ZeroAddress.selector);
        new TitleRegistry(admin, issuer, operator, court, address(0), address(attestation));

        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.RoleOverlap.selector, bytes32(0), titles.ISSUER_ROLE()));
        new TitleRegistry(issuer, issuer, operator, court, address(identity), address(attestation));

        vm.expectRevert(
            abi.encodeWithSelector(RegistryErrors.RoleOverlap.selector, titles.ISSUER_ROLE(), titles.OPERATOR_ROLE())
        );
        new TitleRegistry(admin, issuer, issuer, court, address(identity), address(attestation));
    }

    function test_AdminRegistriesAndModules() public {
        MockAttestationRegistry att2 = new MockAttestationRegistry();
        vm.prank(admin);
        titles.setRegistries(address(identity), address(att2));
        assertEq(address(titles.attestationRegistry()), address(att2));

        vm.prank(admin);
        vm.expectRevert(RegistryErrors.ZeroAddress.selector);
        titles.setRegistries(address(0), address(att2));

        vm.prank(admin);
        vm.expectRevert(RegistryErrors.ZeroAddress.selector);
        titles.addComplianceModule(address(0));

        uint256 before = titles.complianceModuleCount();
        vm.prank(admin);
        titles.removeComplianceModule(0);
        assertEq(titles.complianceModuleCount(), before - 1);

        vm.prank(admin);
        vm.expectRevert(RegistryErrors.Unauthorized.selector);
        titles.removeComplianceModule(99);
    }

    function test_CreateAssetGuards() public {
        vm.prank(issuer);
        vm.expectRevert(RegistryErrors.ZeroAddress.selector);
        titles.createAsset(bytes32(0));

        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.AssetNotActive.selector, assetId));
        titles.createAsset(assetId);
    }

    function test_CourtFreeze() public {
        vm.prank(court);
        titles.setAssetState(assetId, AssetState.Frozen);
        assertEq(uint8(titles.assetState(assetId)), uint8(AssetState.Frozen));

        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.AssetNotActive.selector, assetId));
        titles.issue(assetId, 1, seller);
    }

    function test_DecideRejectedFrozen() public {
        _issue(20, seller);
        vm.prank(operator);
        titles.setAssetState(assetId, AssetState.Frozen); // operator can freeze too

        bytes32 tid = keccak256("t-frz");
        _request(tid, seller, buyer, 5, uint64(block.timestamp + 1 hours));
        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Rejected));
        (,,,,,,, uint8 reason) = titles.requests(tid);
        assertEq(reason, ReasonCode.ASSET_FROZEN);
    }

    function test_DecideRejectedInsufficientBalance() public {
        _issue(5, seller);
        bytes32 tid = keccak256("t-bal");
        _request(tid, seller, buyer, 50, uint64(block.timestamp + 1 hours));
        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Rejected));
        (,,,,,,, uint8 reason) = titles.requests(tid);
        assertEq(reason, ReasonCode.INSUFFICIENT_BALANCE);
    }

    function test_ForcedTransferGuards() public {
        _issue(10, seller);
        vm.prank(court);
        vm.expectRevert(RegistryErrors.ZeroAmount.selector);
        titles.forcedTransfer(assetId, seller, buyer, 0, keccak256("r"));

        vm.prank(court);
        vm.expectRevert(RegistryErrors.ZeroAddress.selector);
        titles.forcedTransfer(assetId, bytes32(0), buyer, 1, keccak256("r"));

        vm.prank(court);
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.InsufficientBalance.selector, assetId, seller));
        titles.forcedTransfer(assetId, seller, buyer, 999, keccak256("r"));
    }

    function test_OnTransferRequestGuards() public {
        vm.prank(bridge);
        vm.expectRevert(RegistryErrors.ZeroAddress.selector);
        titles.onTransferRequest(bytes32(0), assetId, seller, buyer, 1, uint64(block.timestamp + 1));

        bytes32 tid = keccak256("dup");
        _request(tid, seller, buyer, 1, uint64(block.timestamp + 1 hours));
        vm.prank(bridge);
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.RequestAlreadyExists.selector, tid));
        titles.onTransferRequest(tid, assetId, seller, buyer, 1, uint64(block.timestamp + 1 hours));
    }

    function test_ViewHelpers() public {
        _issue(7, seller);
        assertEq(titles.complianceModuleCount(), 3);
        assertEq(titles.entryCount(assetId), 1);
        bytes32 eh = titles.entryHash(assetId, 0);
        bytes32 dh = titles.dataHashAt(assetId, 0);
        assertTrue(eh != bytes32(0));
        assertTrue(dh != bytes32(0));
    }

    function test_UnauthorizedSetState() public {
        vm.prank(issuer);
        vm.expectRevert();
        titles.setAssetState(assetId, AssetState.Paused);

        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.AssetUnknown.selector, keccak256("nope")));
        vm.prank(operator);
        titles.setAssetState(keccak256("nope"), AssetState.Paused);
    }

    function test_UnpauseAsset() public {
        vm.prank(operator);
        titles.setAssetState(assetId, AssetState.Paused);
        vm.prank(operator);
        titles.setAssetState(assetId, AssetState.Active);
        assertEq(uint8(titles.assetState(assetId)), uint8(AssetState.Active));
    }
}
