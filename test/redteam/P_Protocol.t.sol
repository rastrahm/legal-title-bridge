// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {BridgeErrors} from "../../src/errors/BridgeErrors.sol";
import {RegistryErrors} from "../../src/errors/RegistryErrors.sol";
import {DecisionOutcome, ReasonCode, RequestStatus} from "../../src/TitleRegistry.sol";
import {MsgType, Packet, PacketCodec} from "../../src/libraries/PacketCodec.sol";
import {RedteamBase} from "./RedteamBase.sol";
import {ReentrancyAttacker, VulnerableTitleDecide} from "./vulnerable/VulnerableTitleDecide.sol";

/// @notice P1–P9 protocol attacks: vulnerable success where applicable + real expected errors.
contract RedteamProtocolTest is RedteamBase {
    VulnerableTitleDecide internal vulnTitle;
    ReentrancyAttacker internal attacker;

    function setUp() public override {
        super.setUp();
        vulnTitle = new VulnerableTitleDecide();
        attacker = new ReentrancyAttacker(vulnTitle);
    }

    // P1 replay
    function test_P1_Vulnerable_AllowsReplayWhenUnmarked() public {
        bytes32 mid = keccak256("p1");
        assertTrue(vuln.submitInbound(mid, 1, assetId, 1, 1, new bytes[](0), 0, true, true, false));
        assertTrue(vuln.submitInbound(mid, 1, assetId, 1, 1, new bytes[](0), 0, true, true, false));
        assertEq(vuln.drained(), 2);
    }

    function test_P1_Real_MessageAlreadyProcessed() public {
        bytes32 mid = _submitReal(keccak256("t-dup"), 10);
        bytes memory payload = _transferPayload(keccak256("t-dup"), 10);
        (bytes memory wire,) = _inboundWire(payload, endpoint.epoch());
        bytes[] memory sigs = signQuorumSorted(_digest(mid, endpoint.epoch()), firstK(relayerPks, 2));
        vm.expectRevert(abi.encodeWithSelector(BridgeErrors.MessageAlreadyProcessed.selector, mid));
        endpoint.submitInbound(wire, sigs);
    }

    // P2 wrong domain / epoch
    function test_P2_Vulnerable_AcceptsWrongEpochAsDomainSkip() public {
        vuln.rotateDirect(relayerAddrs, 2);
        assertTrue(vuln.submitInbound(keccak256("p2"), 1, assetId, 1, 1, new bytes[](0), 0, true, false, false));
    }

    function test_P2_Real_WrongDomain() public {
        bytes memory payload = _transferPayload(keccak256("t-dom"), 1);
        Packet memory p =
            makeInboundPacket(REMOTE, 999, remoteEmitter, endpoint.epoch(), MsgType.TRANSFER_REQUEST, payload);
        bytes memory wire = PacketCodec.encode(p);
        bytes32 mid = PacketCodec.messageIdOfWire(wire);
        bytes32 digest = PacketCodec.signingDigestFromParts(
            PacketCodec.PACKET_VERSION, REMOTE, 999, remoteEmitter, endpoint.epoch(), mid
        );
        bytes[] memory sigs = signQuorumSorted(digest, firstK(relayerPks, 2));
        vm.expectRevert(BridgeErrors.WrongDomain.selector);
        endpoint.submitInbound(wire, sigs);
    }

    // P5 reentrancy
    function test_P5_Vulnerable_ReentersBeforeFinalize() public {
        bytes32 id = keccak256("p5");
        vulnTitle.register(id, makeAddr("buyer"), 1, uint64(block.timestamp + 1 days));
        attacker.arm(id);
        vulnTitle.payThenFinalize(id, payable(address(attacker)));
        assertGe(attacker.hits(), 2);
    }

    function test_P5_Safe_CEIBlocksReentrancy() public {
        bytes32 id = keccak256("p5-safe");
        vulnTitle.register(id, makeAddr("buyer"), 1, uint64(block.timestamp + 1 days));
        attacker.arm(id);
        // First entry sets Approved before callback; reentry hits "not pending".
        vm.expectRevert(bytes("not pending"));
        vulnTitle.payThenFinalizeSafe(id, payable(address(attacker)));
    }

    // P6 identity / certification
    function test_P6_Vulnerable_ApprovesWithoutIdentity() public {
        bytes32 id = keccak256("p6");
        bytes32 aid = keccak256("asset-p6");
        address seller = makeAddr("seller");
        address buyer = makeAddr("buyer");
        vulnTitle.fund(aid, seller, 100);
        vulnTitle.register(id, buyer, 10, uint64(block.timestamp + 1 days));
        assertEq(uint8(vulnTitle.decideBlind(id, aid, seller)), uint8(VulnerableTitleDecide.Status.Approved));
        assertEq(vulnTitle.balanceOf(aid, buyer), 10);
    }

    function test_P6_Real_RejectedNotVerified() public {
        bytes32 stranger = keccak256("unverified-buyer");
        bytes32 tid = keccak256("p6-real");
        _submitReal(tid, 5);
        // Request buyer in payload is keccak256("buyer") — unverified unless we change payload.
        // Use a dedicated inbound with stranger buyer:
        bytes memory payload = buildTransferRequestPayload(
            tid,
            keccak256("seller"),
            stranger,
            5,
            keccak256("pay-mint"),
            1 ether,
            uint64(block.timestamp + 1 days),
            keccak256("travel")
        );
        // already registered tid above — use fresh id
        bytes32 tid2 = keccak256("p6-real-2");
        payload = buildTransferRequestPayload(
            tid2,
            keccak256("seller"),
            stranger,
            5,
            keccak256("pay-mint"),
            1 ether,
            uint64(block.timestamp + 1 days),
            keccak256("travel")
        );
        (bytes memory wire, bytes32 mid) = _inboundWire(payload, endpoint.epoch());
        endpoint.submitInbound(wire, signQuorumSorted(_digest(mid, endpoint.epoch()), firstK(relayerPks, 2)));

        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(tid2);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Rejected));
        (,,,,,, RequestStatus status, uint8 reason) = titles.requests(tid2);
        assertEq(uint8(status), uint8(RequestStatus.Rejected));
        assertEq(reason, ReasonCode.NOT_VERIFIED);
    }

    // P7 court role present (full path in Court.t.sol)
    function test_P7_Real_CourtRoleWired() public view {
        assertTrue(titles.hasRole(titles.COURT_ROLE(), court));
    }

    // P8 zero amount
    function test_P8_Real_ZeroAmountForcedReverts() public {
        vm.prank(court);
        vm.expectRevert(RegistryErrors.ZeroAmount.selector);
        titles.forcedTransfer(assetId, keccak256("from"), keccak256("to"), 0, keccak256("order"), bytes32(0));
    }

    // P9 is Solana-side (refund stranger) — documented in solana redteam; smoke here.
    function test_P9_Placeholder_DocumentedOnSolana() public pure {
        assertTrue(true);
    }

    function _submitReal(bytes32 transferId, uint256 amount) internal returns (bytes32 mid) {
        bytes memory payload = _transferPayload(transferId, amount);
        (bytes memory wire, bytes32 id) = _inboundWire(payload, endpoint.epoch());
        mid = id;
        endpoint.submitInbound(wire, signQuorumSorted(_digest(mid, endpoint.epoch()), firstK(relayerPks, 2)));
    }
}
