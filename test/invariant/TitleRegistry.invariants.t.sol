// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test} from "forge-std/Test.sol";

import {CountryModule} from "../../src/compliance/CountryModule.sol";
import {LockupModule} from "../../src/compliance/LockupModule.sol";
import {MaxHoldersModule} from "../../src/compliance/MaxHoldersModule.sol";
import {Assertion} from "../../src/interfaces/IIdentityRegistry.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {TitleRegistry} from "../../src/TitleRegistry.sol";
import {MockAttestationRegistry} from "../mocks/MockAttestationRegistry.sol";
import {TitleRegistryHandler} from "./TitleRegistryHandler.sol";

/// @title TitleRegistryInvariants
/// @notice I1 (conservation), I7 (no approve without identity/cert), I9 (ledger chain).
contract TitleRegistryInvariants is Test {
    IdentityRegistry internal identity;
    MockAttestationRegistry internal attestation;
    TitleRegistry internal titles;
    TitleRegistryHandler internal handler;

    address internal admin = makeAddr("admin");
    address internal issuer = makeAddr("issuer");
    address internal operator = makeAddr("operator");
    address internal court = makeAddr("court");
    address internal bridge = makeAddr("bridge");
    address internal complianceAdmin = makeAddr("complianceAdmin");

    uint256 internal verifierPk = 0xA11CE;
    address internal verifier;
    bytes32 internal assetId = keccak256("inv-asset");

    function setUp() public {
        verifier = vm.addr(verifierPk);
        identity = new IdentityRegistry(admin, verifier);
        attestation = new MockAttestationRegistry();
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
        maxHolders.setMaxHolders(assetId, 100);

        attestation.setCertified(assetId, true);
        vm.prank(issuer);
        titles.createAsset(assetId);

        // Seed verified holders so issue can succeed early (names match handler).
        _seedHolder(keccak256("h0"));
        _seedHolder(keccak256("h1"));
        _seedHolder(keccak256("h2"));
        _seedHolder(keccak256("h3"));

        handler = new TitleRegistryHandler(
            titles,
            identity,
            attestation,
            countryMod,
            maxHolders,
            lockup,
            issuer,
            operator,
            court,
            bridge,
            complianceAdmin,
            verifierPk,
            assetId
        );

        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = TitleRegistryHandler.issue.selector;
        selectors[1] = TitleRegistryHandler.requestAndDecide.selector;
        selectors[2] = TitleRegistryHandler.revokeBuyer.selector;
        selectors[3] = TitleRegistryHandler.toggleCert.selector;
        selectors[4] = TitleRegistryHandler.forcedTransfer.selector;
        selectors[5] = TitleRegistryHandler.redeem.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function _seedHolder(bytes32 holder) internal {
        Assertion memory a =
            Assertion({holder: holder, country: 724, investorType: 1, expiry: uint64(block.timestamp + 365 days)});
        bytes32 digest = identity.hashAssertion(a);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierPk, digest);
        identity.registerAssertion(a, abi.encodePacked(r, s, v));
    }

    /// @notice I1: sum of balances == issued − redeemed.
    function invariant_I1_Conservation() public view {
        assertEq(handler.sumBalances(), titles.circulating(assetId));
    }

    /// @notice I7: never Approved with unverified buyer or uncertified asset.
    function invariant_I7_NoBadApproval() public view {
        assertEq(handler.ghostApprovedWhileUnverified(), 0);
        assertEq(handler.ghostApprovedWithoutCert(), 0);
    }

    /// @notice I9: ledger hash chain is contiguous.
    function invariant_I9_LedgerChain() public view {
        assertTrue(titles.verifyLedger(assetId));
    }
}
