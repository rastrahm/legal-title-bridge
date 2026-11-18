// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {CommonBase} from "forge-std/Base.sol";
import {StdUtils} from "forge-std/StdUtils.sol";

import {AttestationRegistry} from "../../src/AttestationRegistry.sol";
import {Assertion} from "../../src/interfaces/IIdentityRegistry.sol";
import {AttestationKind} from "../../src/interfaces/IAttestationRegistry.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {AssetState, DecisionOutcome, TitleRegistry} from "../../src/TitleRegistry.sol";

/// @title AttestationI7Handler
/// @notice Fuzz actions that expire certifications mid-flight (I7).
contract AttestationI7Handler is CommonBase, StdUtils {
    TitleRegistry public immutable TITLES;
    IdentityRegistry public immutable IDENTITY;
    AttestationRegistry public immutable ATTESTATION;

    address public immutable ISSUER;
    address public immutable OPERATOR;
    address public immutable BRIDGE;
    uint256 public immutable VERIFIER_PK;
    uint256 public immutable C1_PK;
    uint256 public immutable C2_PK;

    bytes32 public immutable ASSET_ID;
    bytes32 public immutable SELLER;
    bytes32 public immutable BUYER;

    uint256 public ghostApprovedWithoutCert;
    uint256 public ghostApprovedUnverifiedBuyer;
    uint256 public calls;

    constructor(
        TitleRegistry titles_,
        IdentityRegistry identity_,
        AttestationRegistry attestation_,
        address issuer_,
        address operator_,
        address bridge_,
        uint256 verifierPk_,
        uint256 c1Pk_,
        uint256 c2Pk_,
        bytes32 assetId_,
        bytes32 seller_,
        bytes32 buyer_
    ) {
        TITLES = titles_;
        IDENTITY = identity_;
        ATTESTATION = attestation_;
        ISSUER = issuer_;
        OPERATOR = operator_;
        BRIDGE = bridge_;
        VERIFIER_PK = verifierPk_;
        C1_PK = c1Pk_;
        C2_PK = c2Pk_;
        ASSET_ID = assetId_;
        SELLER = seller_;
        BUYER = buyer_;
    }

    function refreshCerts(uint256 ttl) external {
        ++calls;
        ttl = bound(ttl, 1 hours, 30 days);
        // casting to uint64 is safe: ttl <= 30 days and test timestamps stay in range
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 expiry = uint64(block.timestamp + ttl);
        _attestBoth(C1_PK, expiry);
        _attestBoth(C2_PK, expiry);
    }

    function warpPastCert(uint256 extra) external {
        ++calls;
        extra = bound(extra, 1, 60 days);
        vm.warp(block.timestamp + extra);
    }

    function issue(uint256 amount) external {
        ++calls;
        amount = bound(amount, 1, 200);
        if (TITLES.assetState(ASSET_ID) != AssetState.Active) {
            return;
        }
        if (!ATTESTATION.isCertified(ASSET_ID)) {
            return;
        }
        if (!IDENTITY.isVerified(SELLER)) {
            return;
        }
        vm.prank(ISSUER);
        try TITLES.issue(ASSET_ID, amount, SELLER) {} catch {}
    }

    function requestAndDecide(uint256 amount, uint256 ttl, bool warpBeforeDecide) external {
        ++calls;
        amount = bound(amount, 1, 100);
        if (TITLES.balanceOf(ASSET_ID, SELLER) < amount) {
            return;
        }
        ttl = bound(ttl, 1 hours, 7 days);
        bytes32 tid = keccak256(abi.encode("i7", calls, amount, ttl));

        // casting to uint64 is safe: ttl bounded and test timestamps stay in range
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 deadline = uint64(block.timestamp + ttl);

        vm.prank(BRIDGE);
        try TITLES.onTransferRequest(tid, ASSET_ID, SELLER, BUYER, amount, deadline) {
            if (warpBeforeDecide) {
                vm.warp(block.timestamp + bound(ttl / 2, 1, ttl));
            }
            bool certOk = ATTESTATION.isCertified(ASSET_ID);
            bool buyerOk = IDENTITY.isVerified(BUYER);

            vm.prank(OPERATOR);
            try TITLES.decide(tid) returns (DecisionOutcome outcome) {
                if (outcome == DecisionOutcome.Approved) {
                    if (!certOk) {
                        ++ghostApprovedWithoutCert;
                    }
                    if (!buyerOk) {
                        ++ghostApprovedUnverifiedBuyer;
                    }
                }
            } catch {}
        } catch {}
    }

    function revokeBuyer() external {
        ++calls;
        if (!IDENTITY.isVerified(BUYER)) {
            return;
        }
        vm.prank(vm.addr(VERIFIER_PK));
        try IDENTITY.revoke(BUYER) {} catch {}
    }

    function reVerifyBuyer(uint256 ttl) external {
        ++calls;
        ttl = bound(ttl, 1 days, 365 days);
        Assertion memory a = Assertion({
            holder: BUYER,
            country: 724,
            investorType: 1,
            // forge-lint: disable-next-line(unsafe-typecast)
            expiry: uint64(block.timestamp + ttl)
        });
        bytes32 digest = IDENTITY.hashAssertion(a);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(VERIFIER_PK, digest);
        try IDENTITY.registerAssertion(a, abi.encodePacked(r, s, v)) {} catch {}
    }

    function _attestBoth(uint256 pk, uint64 expiry) internal {
        _attest(pk, AttestationKind.EXISTENCE, expiry);
        _attest(pk, AttestationKind.REGISTRAL, expiry);
    }

    function _attest(uint256 pk, uint8 kind, uint64 expiry) internal {
        bytes32 digest = ATTESTATION.hashAttestation(ASSET_ID, kind, expiry);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        try ATTESTATION.attest(ASSET_ID, kind, expiry, abi.encodePacked(r, s, v)) {} catch {}
    }
}
