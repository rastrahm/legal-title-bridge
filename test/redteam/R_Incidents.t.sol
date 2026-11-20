// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {BridgeErrors} from "../../src/errors/BridgeErrors.sol";
import {MsgType, Packet, PacketCodec} from "../../src/libraries/PacketCodec.sol";
import {RelayerQuorum} from "../../src/libraries/RelayerQuorum.sol";
import {BridgeEndpoint} from "../../src/BridgeEndpoint.sol";
import {RedteamBase} from "./RedteamBase.sol";
import {VulnerableBridgeEndpoint} from "./vulnerable/VulnerableBridgeEndpoint.sol";

/// @notice R1–R7: success vs VulnerableBridgeEndpoint, expected revert vs real BridgeEndpoint.
contract RedteamIncidentsTest is RedteamBase {
    // -------------------------------------------------------------------------
    // R1 Poly Network — inbound must not rotate governance
    // -------------------------------------------------------------------------

    function test_R1_Vulnerable_InboundRotatesGovernance() public {
        address[] memory newSet = new address[](3);
        newSet[0] = makeAddr("evil1");
        newSet[1] = makeAddr("evil2");
        newSet[2] = makeAddr("evil3");
        // Attacker uses open dispatcher acceptance then rotateDirect (Poly-style).
        bool ok = vuln.submitInbound(
            keccak256("r1"),
            VulnerableBridgeEndpoint(address(vuln)).MSG_SET_RELAYERS(),
            bytes32(0),
            0,
            1,
            new bytes[](0),
            bytes32(0),
            true,
            true,
            false
        );
        assertTrue(ok);
        vuln.rotateDirect(newSet, 2);
        assertEq(vuln.relayers(0), newSet[0]);
        assertEq(vuln.epoch(), 2);
    }

    function test_R1_Real_InboundCannotRotate() public {
        bytes memory issuePayload = buildIssuePayload(assetId, 1, keccak256("to"));
        Packet memory p = makeInboundPacket(REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), MsgType.ISSUE, issuePayload);
        bytes memory wire = PacketCodec.encode(p);
        bytes32 mid = PacketCodec.messageIdOfWire(wire);
        bytes32 digest = _digest(mid, endpoint.epoch());
        bytes[] memory sigsR1 = signQuorumSorted(digest, firstK(relayerPks, 2));
        vm.expectRevert(abi.encodeWithSelector(BridgeErrors.UnsupportedMsgType.selector, uint8(0)));
        endpoint.submitInbound(wire, sigsR1);
        assertEq(endpoint.relayerCount(), 3);
        assertEq(endpoint.epoch(), 1);
    }

    // -------------------------------------------------------------------------
    // R2 Qubit — EmptyCode on setTitleRegistry
    // -------------------------------------------------------------------------

    function test_R2_Vulnerable_AcceptsEOARegistry() public {
        address eoa = makeAddr("eoa-registry");
        assertEq(eoa.code.length, 0);
        vuln.setTitleRegistry(eoa);
        assertEq(vuln.titleRegistry(), eoa);
    }

    function test_R2_Real_EmptyCodeReverts() public {
        address eoa = makeAddr("eoa-registry");
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(BridgeErrors.EmptyCode.selector, eoa));
        endpoint.setTitleRegistry(eoa);
    }

    // -------------------------------------------------------------------------
    // R5a Ronin — k = threshold − 1
    // -------------------------------------------------------------------------

    function test_R5a_Vulnerable_AcceptsUnderQuorumWhenDisabled() public {
        bytes32 mid = keccak256("r5a-v");
        bytes32 digest = keccak256("digest-r5a");
        // requireQuorum=false → accepts with zero sigs (also covers R7 shape)
        bool ok = vuln.submitInbound(mid, 1, assetId, 10, 1, new bytes[](0), digest, true, false, false);
        assertTrue(ok);
        assertEq(vuln.drained(), 10);
    }

    function test_R5a_Real_InsufficientQuorum() public {
        bytes memory payload = _transferPayload(keccak256("t-r5a"), 10);
        (bytes memory wire, bytes32 mid) = _inboundWire(payload, endpoint.epoch());
        bytes32 digest = _digest(mid, endpoint.epoch());
        bytes[] memory sigsR5a = signQuorumSorted(digest, firstK(relayerPks, 1));
        vm.expectRevert(BridgeErrors.InvalidQuorum.selector);
        endpoint.submitInbound(wire, sigsR5a);
        assertFalse(endpoint.processed(mid));
    }

    // -------------------------------------------------------------------------
    // R5b — removed / stale epoch
    // -------------------------------------------------------------------------

    function test_R5b_Vulnerable_AcceptsStaleEpoch() public {
        vuln.rotateDirect(relayerAddrs, 2); // epoch → 2
        bytes32 mid = keccak256("r5b-v");
        bool ok = vuln.submitInbound(mid, 1, assetId, 1, 1, new bytes[](0), bytes32(0), true, false, false);
        assertTrue(ok);
    }

    function test_R5b_Real_StaleEpochWrongDomain() public {
        address[] memory newSet = new address[](3);
        newSet[0] = vm.addr(r1Pk);
        newSet[1] = vm.addr(r2Pk);
        newSet[2] = makeAddr("r4");
        vm.prank(admin);
        endpoint.proposeRotateRelayers(newSet, 2);
        vm.warp(block.timestamp + 1 days);
        vm.prank(admin);
        endpoint.executeRotateRelayers();

        bytes memory payload = _transferPayload(keccak256("t-r5b"), 10);
        (bytes memory wire, bytes32 mid) = _inboundWire(payload, 1);
        bytes32 digest =
            PacketCodec.signingDigestFromParts(PacketCodec.PACKET_VERSION, REMOTE, LOCAL, remoteEmitter, 1, mid);
        uint256[] memory oldPks = new uint256[](2);
        oldPks[0] = r1Pk;
        oldPks[1] = r2Pk;
        bytes[] memory sigsR5b = signQuorumSorted(digest, oldPks);
        vm.expectRevert(BridgeErrors.WrongDomain.selector);
        endpoint.submitInbound(wire, sigsR5b);
    }

    // -------------------------------------------------------------------------
    // R5c — flow limit + pause; measure drain on vulnerable
    // -------------------------------------------------------------------------

    function test_R5c_Vulnerable_DrainsPastDesignCap() public {
        // Real window=1000 perTransfer=500; vulnerable has no cap.
        bool ok = vuln.submitInbound(keccak256("d1"), 1, assetId, 10_000, 1, new bytes[](0), 0, true, false, false);
        assertTrue(ok);
        assertEq(vuln.drained(), 10_000);
        vuln.pause();
        bool afterPause = vuln.submitInbound(keccak256("d2"), 1, assetId, 1, 1, new bytes[](0), 0, true, false, false);
        assertFalse(afterPause);
    }

    function test_R5c_Real_FlowLimitAndPause() public {
        bytes memory payload = _transferPayload(keccak256("t-flow"), 501);
        (bytes memory wire, bytes32 mid) = _inboundWire(payload, endpoint.epoch());
        bytes[] memory sigsOver = signQuorumSorted(_digest(mid, endpoint.epoch()), firstK(relayerPks, 2));
        vm.expectRevert(abi.encodeWithSelector(BridgeErrors.FlowLimitExceeded.selector, assetId));
        endpoint.submitInbound(wire, sigsOver);

        // Fill window with two 500s
        _submitReal(keccak256("t-a"), 500);
        _submitReal(keccak256("t-b"), 500);
        assertEq(endpoint.flowRemaining(assetId), 0);

        vm.prank(guardian);
        endpoint.pause();
        bytes memory payload2 = _transferPayload(keccak256("t-p"), 1);
        (bytes memory wire2, bytes32 mid2) = _inboundWire(payload2, endpoint.epoch());
        bytes[] memory sigsPaused = signQuorumSorted(_digest(mid2, endpoint.epoch()), firstK(relayerPks, 2));
        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert(BridgeErrors.Paused.selector);
        endpoint.submitInbound(wire2, sigsPaused);
    }

    // -------------------------------------------------------------------------
    // R6 Harmony — low threshold
    // -------------------------------------------------------------------------

    function test_R6_Vulnerable_Allows2of5() public {
        assertEq(vuln.threshold(), 2);
        assertEq(vuln.relayers(4), makeAddr("r5")); // 5-member set from setUp
    }

    function test_R6_Real_DeployAndRotateThresholdTooLow() public {
        address[] memory five = new address[](5);
        for (uint256 i; i < 5; ++i) {
            five[i] = makeAddr(string(abi.encodePacked("rx", i)));
        }
        vm.expectRevert(BridgeErrors.ThresholdTooLow.selector);
        new BridgeEndpoint(admin, guardian, five, 2, LOCAL, REMOTE, remoteEmitter, assetId, 1 days, 100, 50);

        vm.prank(admin);
        vm.expectRevert(BridgeErrors.ThresholdTooLow.selector);
        endpoint.proposeRotateRelayers(five, 2);

        assertGe(uint256(2), RelayerQuorum.minThreshold(3));
    }

    // -------------------------------------------------------------------------
    // R7 Nomad — default-unknown must not process
    // -------------------------------------------------------------------------

    function test_R7_Vulnerable_DefaultAcceptWithoutQuorum() public {
        bool ok = vuln.submitInbound(keccak256("r7"), 1, assetId, 1, 1, new bytes[](0), 0, true, false, false);
        assertTrue(ok);
        assertTrue(vuln.processed(keccak256("r7")));
    }

    function test_R7_Real_UnknownWithoutQuorum() public {
        bytes memory payload = _transferPayload(keccak256("t-r7"), 1);
        (bytes memory wire, bytes32 mid) = _inboundWire(payload, endpoint.epoch());
        bytes[] memory empty;
        vm.expectRevert(BridgeErrors.InvalidQuorum.selector);
        endpoint.submitInbound(wire, empty);
        assertFalse(endpoint.processed(mid));
    }

    function _submitReal(bytes32 transferId, uint256 amount) internal {
        bytes memory payload = _transferPayload(transferId, amount);
        (bytes memory wire, bytes32 mid) = _inboundWire(payload, endpoint.epoch());
        endpoint.submitInbound(wire, signQuorumSorted(_digest(mid, endpoint.epoch()), firstK(relayerPks, 2)));
    }
}
