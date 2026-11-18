// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test} from "forge-std/Test.sol";

import {AttestationRegistry} from "../../src/AttestationRegistry.sol";
import {CountryModule} from "../../src/compliance/CountryModule.sol";
import {LockupModule} from "../../src/compliance/LockupModule.sol";
import {MaxHoldersModule} from "../../src/compliance/MaxHoldersModule.sol";
import {Assertion} from "../../src/interfaces/IIdentityRegistry.sol";
import {AttestationKind} from "../../src/interfaces/IAttestationRegistry.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {TitleRegistry} from "../../src/TitleRegistry.sol";
import {AttestationI7Handler} from "./AttestationI7Handler.sol";

/// @title AttestationI7Invariants
/// @notice I7 under cert expiry / identity revoke during fuzz (ATTEST exit criterion).
contract AttestationI7Invariants is Test {
    IdentityRegistry internal identity;
    AttestationRegistry internal attestation;
    TitleRegistry internal titles;
    AttestationI7Handler internal handler;

    address internal admin = makeAddr("admin");
    address internal issuer = makeAddr("issuer");
    address internal operator = makeAddr("operator");
    address internal court = makeAddr("court");
    address internal bridge = makeAddr("bridge");
    address internal complianceAdmin = makeAddr("complianceAdmin");

    uint256 internal verifierPk = 0xA11CE;
    uint256 internal c1Pk = 0xC01;
    uint256 internal c2Pk = 0xC02;

    bytes32 internal assetId = keccak256("i7-asset");
    bytes32 internal seller = keccak256("i7-seller");
    bytes32 internal buyer = keccak256("i7-buyer");

    function setUp() public {
        identity = new IdentityRegistry(admin, vm.addr(verifierPk));

        address[] memory certs = new address[](2);
        certs[0] = vm.addr(c1Pk);
        certs[1] = vm.addr(c2Pk);
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
        maxHolders.setMaxHolders(assetId, 50);

        _seedIdentity(seller);
        _seedIdentity(buyer);
        _seedCerts(uint64(block.timestamp + 365 days));

        vm.prank(issuer);
        titles.createAsset(assetId);
        vm.prank(issuer);
        titles.issue(assetId, 1_000, seller);

        handler = new AttestationI7Handler(
            titles, identity, attestation, issuer, operator, bridge, verifierPk, c1Pk, c2Pk, assetId, seller, buyer
        );

        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = AttestationI7Handler.refreshCerts.selector;
        selectors[1] = AttestationI7Handler.warpPastCert.selector;
        selectors[2] = AttestationI7Handler.issue.selector;
        selectors[3] = AttestationI7Handler.requestAndDecide.selector;
        selectors[4] = AttestationI7Handler.revokeBuyer.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function _seedIdentity(bytes32 holder) internal {
        Assertion memory a =
            Assertion({holder: holder, country: 724, investorType: 1, expiry: uint64(block.timestamp + 365 days)});
        bytes32 digest = identity.hashAssertion(a);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierPk, digest);
        identity.registerAssertion(a, abi.encodePacked(r, s, v));
    }

    function _seedCerts(uint64 expiry) internal {
        _attest(c1Pk, AttestationKind.EXISTENCE, expiry);
        _attest(c1Pk, AttestationKind.REGISTRAL, expiry);
        _attest(c2Pk, AttestationKind.EXISTENCE, expiry);
        _attest(c2Pk, AttestationKind.REGISTRAL, expiry);
    }

    function _attest(uint256 pk, uint8 kind, uint64 expiry) internal {
        bytes32 digest = attestation.hashAttestation(assetId, kind, expiry);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        attestation.attest(assetId, kind, expiry, abi.encodePacked(r, s, v));
    }

    function invariant_I7_NoBadApproval() public view {
        assertEq(handler.ghostApprovedWithoutCert(), 0);
        assertEq(handler.ghostApprovedUnverifiedBuyer(), 0);
    }
}
