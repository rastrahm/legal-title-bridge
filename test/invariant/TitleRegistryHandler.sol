// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {CommonBase} from "forge-std/Base.sol";
import {StdUtils} from "forge-std/StdUtils.sol";

import {CountryModule} from "../../src/compliance/CountryModule.sol";
import {LockupModule} from "../../src/compliance/LockupModule.sol";
import {MaxHoldersModule} from "../../src/compliance/MaxHoldersModule.sol";
import {Assertion} from "../../src/interfaces/IIdentityRegistry.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {AssetState, DecisionOutcome, TitleRegistry} from "../../src/TitleRegistry.sol";
import {MockAttestationRegistry} from "../mocks/MockAttestationRegistry.sol";

/// @title TitleRegistryHandler
/// @notice Bounded caller for I1 / I7 / I9 invariant campaigns.
contract TitleRegistryHandler is CommonBase, StdUtils {
    TitleRegistry public immutable TITLES;
    IdentityRegistry public immutable IDENTITY;
    MockAttestationRegistry public immutable ATTESTATION;
    CountryModule public immutable COUNTRY_MOD;
    MaxHoldersModule public immutable MAX_HOLDERS;
    LockupModule public immutable LOCKUP;

    address public immutable ISSUER;
    address public immutable OPERATOR;
    address public immutable COURT;
    address public immutable BRIDGE;
    address public immutable COMPLIANCE_ADMIN;
    uint256 public immutable VERIFIER_PK;

    bytes32 public immutable ASSET_ID;

    bytes32[] public holders;
    bytes32[] public transferIds;

    uint256 public ghostApprovedWhileUnverified;
    uint256 public ghostApprovedWithoutCert;
    uint256 public calls;

    constructor(
        TitleRegistry titles_,
        IdentityRegistry identity_,
        MockAttestationRegistry attestation_,
        CountryModule countryMod_,
        MaxHoldersModule maxHolders_,
        LockupModule lockup_,
        address issuer_,
        address operator_,
        address court_,
        address bridge_,
        address complianceAdmin_,
        uint256 verifierPk_,
        bytes32 assetId_
    ) {
        TITLES = titles_;
        IDENTITY = identity_;
        ATTESTATION = attestation_;
        COUNTRY_MOD = countryMod_;
        MAX_HOLDERS = maxHolders_;
        LOCKUP = lockup_;
        ISSUER = issuer_;
        OPERATOR = operator_;
        COURT = court_;
        BRIDGE = bridge_;
        COMPLIANCE_ADMIN = complianceAdmin_;
        VERIFIER_PK = verifierPk_;
        ASSET_ID = assetId_;

        holders.push(keccak256("h0"));
        holders.push(keccak256("h1"));
        holders.push(keccak256("h2"));
        holders.push(keccak256("h3"));
    }

    function holderCount() external view returns (uint256) {
        return holders.length;
    }

    function sumBalances() public view returns (uint256 sum) {
        uint256 n = holders.length;
        for (uint256 i; i < n; ++i) {
            sum += TITLES.balanceOf(ASSET_ID, holders[i]);
        }
    }

    function issue(uint256 holderSeed, uint256 amount) external {
        ++calls;
        bytes32 to = holders[bound(holderSeed, 0, holders.length - 1)];
        amount = bound(amount, 1, 1_000);
        _ensureVerified(to, 724);
        ATTESTATION.setCertified(ASSET_ID, true);
        if (TITLES.assetState(ASSET_ID) != AssetState.Active) {
            return;
        }

        vm.prank(ISSUER);
        try TITLES.issue(ASSET_ID, amount, to) {} catch {}
    }

    function requestAndDecide(uint256 fromSeed, uint256 toSeed, uint256 amount, uint256 ttl, bool warpPast) external {
        ++calls;
        bytes32 from = holders[bound(fromSeed, 0, holders.length - 1)];
        bytes32 to = holders[bound(toSeed, 0, holders.length - 1)];
        if (from == to) {
            return;
        }
        amount = bound(amount, 1, 500);
        if (TITLES.balanceOf(ASSET_ID, from) < amount) {
            return;
        }

        // ttl bounded to 7 days; block.timestamp + ttl fits uint64 for fuzz horizon.
        ttl = bound(ttl, 1, 7 days);
        bytes32 tid = keccak256(abi.encode("tid", transferIds.length, calls));
        transferIds.push(tid);

        // casting to uint64 is safe because ttl <= 7 days and timestamp stays in range for tests
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 deadline = uint64(block.timestamp + ttl);

        vm.prank(BRIDGE);
        try TITLES.onTransferRequest(tid, ASSET_ID, from, to, amount, deadline) {
            if (warpPast) {
                vm.warp(block.timestamp + ttl + 1);
            }
            bool buyerOk = IDENTITY.isVerified(to);
            bool certOk = ATTESTATION.isCertified(ASSET_ID);

            vm.prank(OPERATOR);
            try TITLES.decide(tid) returns (DecisionOutcome outcome) {
                if (outcome == DecisionOutcome.Approved) {
                    if (!buyerOk) {
                        ++ghostApprovedWhileUnverified;
                    }
                    if (!certOk) {
                        ++ghostApprovedWithoutCert;
                    }
                }
            } catch {}
        } catch {}
    }

    function revokeBuyer(uint256 holderSeed) external {
        ++calls;
        bytes32 h = holders[bound(holderSeed, 0, holders.length - 1)];
        if (!IDENTITY.isVerified(h)) {
            return;
        }
        address verifier = vm.addr(VERIFIER_PK);
        vm.prank(verifier);
        try IDENTITY.revoke(h) {} catch {}
    }

    function toggleCert(bool on) external {
        ++calls;
        ATTESTATION.setCertified(ASSET_ID, on);
    }

    function forcedTransfer(uint256 fromSeed, uint256 toSeed, uint256 amount) external {
        ++calls;
        bytes32 from = holders[bound(fromSeed, 0, holders.length - 1)];
        bytes32 to = holders[bound(toSeed, 0, holders.length - 1)];
        if (from == to) {
            return;
        }
        amount = bound(amount, 1, 500);
        if (TITLES.balanceOf(ASSET_ID, from) < amount) {
            return;
        }
        vm.prank(COURT);
        try TITLES.forcedTransfer(ASSET_ID, from, to, amount, keccak256(abi.encode(calls))) {} catch {}
    }

    function redeem(uint256 holderSeed, uint256 amount) external {
        ++calls;
        bytes32 h = holders[bound(holderSeed, 0, holders.length - 1)];
        amount = bound(amount, 1, 500);
        if (TITLES.balanceOf(ASSET_ID, h) < amount) {
            return;
        }
        vm.prank(COURT);
        try TITLES.redeemInKind(ASSET_ID, h, amount) {} catch {}
    }

    function setState(uint8 stateSeed) external {
        ++calls;
        uint256 s = bound(stateSeed, 1, 3); // Active / Paused / Frozen
        AssetState next = AssetState(s);
        AssetState cur = TITLES.assetState(ASSET_ID);
        if (cur == next || cur == AssetState.Unknown) {
            return;
        }
        if (next == AssetState.Frozen) {
            vm.prank(COURT);
            try TITLES.setAssetState(ASSET_ID, next) {} catch {}
        } else {
            vm.prank(OPERATOR);
            try TITLES.setAssetState(ASSET_ID, next) {} catch {}
        }
    }

    function _ensureVerified(bytes32 holder, uint16 country) internal {
        if (IDENTITY.isVerified(holder)) {
            return;
        }
        Assertion memory a =
            Assertion({holder: holder, country: country, investorType: 1, expiry: uint64(block.timestamp + 365 days)});
        bytes32 digest = IDENTITY.hashAssertion(a);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(VERIFIER_PK, digest);
        IDENTITY.registerAssertion(a, abi.encodePacked(r, s, v));
    }
}
