// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Vm} from "forge-std/Vm.sol";

import {MockAttestationRegistry} from "../mocks/MockAttestationRegistry.sol";
import {BridgeEndpoint} from "../../src/BridgeEndpoint.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {Assertion} from "../../src/interfaces/IIdentityRegistry.sol";
import {DecisionOutcome, ReasonCode, RequestStatus, TitleRegistry} from "../../src/TitleRegistry.sol";
import {MsgType, Packet, PacketCodec} from "../../src/libraries/PacketCodec.sol";
import {BridgePacketHelpers} from "../helpers/BridgePacketHelpers.sol";
import {IdentitySig} from "../helpers/IdentitySig.sol";

/// @notice DVP Ethereum side: D4 decide → TRANSFER_DECISION outbound; P6 / I4.
contract DvpDecisionTest is BridgePacketHelpers, IdentitySig {
    BridgeEndpoint internal endpoint;
    TitleRegistry internal titles;
    IdentityRegistry internal identity;
    MockAttestationRegistry internal attestation;

    address internal admin = makeAddr("admin");
    address internal guardian = makeAddr("guardian");
    address internal issuer = makeAddr("issuer");
    address internal operator = makeAddr("operator");
    address internal court = makeAddr("court");

    uint256 internal r1Pk = 0xB01;
    uint256 internal r2Pk = 0xB02;
    uint256 internal r3Pk = 0xB03;
    uint256 internal verifierPk = 0xC11CE;

    uint64 internal constant LOCAL = 31337;
    uint64 internal constant REMOTE = 100001;
    bytes32 internal remoteEmitter = keccak256("solana-program");
    bytes32 internal assetId = keccak256("dvp-asset");
    bytes32 internal seller = keccak256("seller-sol");
    bytes32 internal buyer = keccak256("buyer-sol");

    function setUp() public {
        address[] memory relayers = new address[](3);
        relayers[0] = vm.addr(r1Pk);
        relayers[1] = vm.addr(r2Pk);
        relayers[2] = vm.addr(r3Pk);

        endpoint = new BridgeEndpoint(admin, guardian, relayers, 2, LOCAL, REMOTE, remoteEmitter, assetId, 1 days, 0, 0);

        identity = new IdentityRegistry(admin, vm.addr(verifierPk));
        attestation = new MockAttestationRegistry();
        titles = new TitleRegistry(admin, issuer, operator, court, address(identity), address(attestation));

        vm.startPrank(admin);
        titles.grantRole(titles.BRIDGE_ROLE(), address(endpoint));
        endpoint.setTitleRegistry(address(titles));
        titles.setBridgeEndpoint(address(endpoint));
        vm.stopPrank();

        _verify(seller);
        _verify(buyer);
        attestation.setCertified(assetId, true);
        vm.prank(issuer);
        titles.createAsset(assetId);
        vm.prank(issuer);
        titles.issue(assetId, 100, seller);
    }

    function _verify(bytes32 holder) internal {
        Assertion memory a =
            Assertion({holder: holder, country: 724, investorType: 1, expiry: uint64(block.timestamp + 365 days)});
        identity.registerAssertion(a, signAssertion(identity, verifierPk, a));
    }

    function _register(bytes32 tid, bytes32 from, bytes32 to, uint256 amount, uint64 deadline) internal {
        bytes memory payload = buildTransferRequestPayload(
            tid, from, to, amount, keccak256("pay"), 1 ether, deadline, keccak256("travel")
        );
        Packet memory p =
            makeInboundPacket(REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), MsgType.TRANSFER_REQUEST, payload);
        bytes memory wire = PacketCodec.encode(p);
        bytes32 mid = PacketCodec.messageIdOfWire(wire);
        bytes32 digest = PacketCodec.signingDigestFromParts(
            PacketCodec.PACKET_VERSION, REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), mid
        );
        uint256[] memory pks = new uint256[](3);
        pks[0] = r1Pk;
        pks[1] = r2Pk;
        pks[2] = r3Pk;
        endpoint.submitInbound(wire, signQuorumSorted(digest, pks));
    }

    function test_DecideApproved_EmitsTransferDecisionOutbound() public {
        bytes32 tid = keccak256("dvp-ok");
        _register(tid, seller, buyer, 10, uint64(block.timestamp + 1 days));

        vm.recordLogs();
        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Approved));

        (,,,,,, RequestStatus status,) = titles.requests(tid);
        assertEq(uint8(status), uint8(RequestStatus.Approved));
        assertEq(titles.balanceOf(assetId, buyer), 10);
        assertEq(titles.balanceOf(assetId, seller), 90);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 outboundTopic = keccak256("OutboundEmitted(bytes32,uint8,bytes)");
        bool found;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == address(endpoint) && logs[i].topics[0] == outboundTopic) {
                (uint8 mt,) = abi.decode(logs[i].data, (uint8, bytes));
                assertEq(mt, uint8(MsgType.TRANSFER_DECISION));
                found = true;
                break;
            }
        }
        assertTrue(found, "TRANSFER_DECISION outbound missing");
    }

    function test_DecideExpired_D4() public {
        bytes32 tid = keccak256("dvp-exp");
        uint64 deadline = uint64(block.timestamp + 10);
        _register(tid, seller, buyer, 10, deadline);
        vm.warp(deadline + 1);

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Expired));
        assertEq(titles.balanceOf(assetId, seller), 100);
    }

    function test_P6_DecideRejected_NotVerified() public {
        bytes32 stranger = keccak256("unverified");
        bytes32 tid = keccak256("dvp-p6");
        _register(tid, seller, stranger, 5, uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Rejected));
        (,,,,,,, uint8 reason) = titles.requests(tid);
        assertEq(reason, ReasonCode.NOT_VERIFIED);
    }

    function test_I4_CannotDecideTwice() public {
        bytes32 tid = keccak256("dvp-twice");
        _register(tid, seller, buyer, 10, uint64(block.timestamp + 1 days));
        vm.prank(operator);
        titles.decide(tid);
        vm.prank(operator);
        vm.expectRevert();
        titles.decide(tid);
    }
}
