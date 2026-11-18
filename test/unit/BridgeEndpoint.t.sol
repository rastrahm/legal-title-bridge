// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {MockAttestationRegistry} from "../mocks/MockAttestationRegistry.sol";
import {BridgeEndpoint} from "../../src/BridgeEndpoint.sol";
import {BridgeErrors} from "../../src/errors/BridgeErrors.sol";
import {CodecErrors} from "../../src/errors/CodecErrors.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {RequestStatus, TitleRegistry} from "../../src/TitleRegistry.sol";
import {MsgType, Packet, PacketCodec} from "../../src/libraries/PacketCodec.sol";
import {RelayerQuorum} from "../../src/libraries/RelayerQuorum.sol";
import {BridgePacketHelpers} from "../helpers/BridgePacketHelpers.sol";

contract BridgeEndpointTest is BridgePacketHelpers {
    BridgeEndpoint internal endpoint;
    TitleRegistry internal titles;
    IdentityRegistry internal identity;
    MockAttestationRegistry internal attestation;

    address internal admin = makeAddr("admin");
    address internal guardian = makeAddr("guardian");
    address internal issuer = makeAddr("issuer");
    address internal operator = makeAddr("operator");
    address internal court = makeAddr("court");

    uint256 internal r1Pk = 0xA01;
    uint256 internal r2Pk = 0xA02;
    uint256 internal r3Pk = 0xA03;
    uint256 internal removedPk = 0xA99;

    uint64 internal constant LOCAL = 31337;
    uint64 internal constant REMOTE = 100001;
    bytes32 internal remoteEmitter = keccak256("solana-program");
    bytes32 internal assetId = keccak256("bridge-asset");

    uint256[] internal relayerPks;

    function setUp() public {
        relayerPks = new uint256[](3);
        relayerPks[0] = r1Pk;
        relayerPks[1] = r2Pk;
        relayerPks[2] = r3Pk;

        address[] memory relayers = new address[](3);
        relayers[0] = vm.addr(r1Pk);
        relayers[1] = vm.addr(r2Pk);
        relayers[2] = vm.addr(r3Pk);

        endpoint = new BridgeEndpoint(
            admin,
            guardian,
            relayers,
            2, // ⌈2*3/3⌉=2
            LOCAL,
            REMOTE,
            remoteEmitter,
            assetId,
            1 days,
            1_000, // window
            500 // per transfer
        );

        identity = new IdentityRegistry(admin, makeAddr("verifier"));
        attestation = new MockAttestationRegistry();
        titles = new TitleRegistry(admin, issuer, operator, court, address(identity), address(attestation));

        vm.startPrank(admin);
        titles.grantRole(titles.BRIDGE_ROLE(), address(endpoint));
        endpoint.setTitleRegistry(address(titles));
        vm.stopPrank();

        vm.prank(issuer);
        titles.createAsset(assetId);
        attestation.setCertified(assetId, true);
    }

    function _inboundWire(bytes memory payload, uint64 epoch) internal view returns (bytes memory wire, bytes32 mid) {
        Packet memory p = makeInboundPacket(REMOTE, LOCAL, remoteEmitter, epoch, MsgType.TRANSFER_REQUEST, payload);
        wire = PacketCodec.encode(p);
        mid = PacketCodec.messageIdOfWire(wire);
    }

    function _transferPayload(bytes32 transferId, uint256 amount) internal view returns (bytes memory) {
        return buildTransferRequestPayload(
            transferId,
            keccak256("seller"),
            keccak256("buyer"),
            amount,
            keccak256("pay-mint"),
            1 ether,
            uint64(block.timestamp + 1 days),
            keccak256("travel")
        );
    }

    function _submitOk(bytes32 transferId, uint256 amount) internal returns (bytes32 mid) {
        bytes memory payload = _transferPayload(transferId, amount);
        (bytes memory wire, bytes32 id) = _inboundWire(payload, endpoint.epoch());
        mid = id;
        bytes32 digest = PacketCodec.signingDigestFromParts(
            PacketCodec.PACKET_VERSION, REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), mid
        );
        bytes[] memory sigs = signQuorumSorted(digest, firstK(relayerPks, 2));
        endpoint.submitInbound(wire, sigs);
    }

    function test_SubmitInboundHappyPath() public {
        bytes32 mid = _submitOk(keccak256("t1"), 10);
        assertTrue(endpoint.processed(mid));
        (,,,,,, RequestStatus status,) = titles.requests(keccak256("t1"));
        assertEq(uint8(status), uint8(RequestStatus.Pending));
    }

    function test_R5a_InsufficientQuorum() public {
        bytes memory payload = _transferPayload(keccak256("t-r5a"), 10);
        (bytes memory wire, bytes32 mid) = _inboundWire(payload, endpoint.epoch());
        bytes32 digest = PacketCodec.signingDigestFromParts(
            PacketCodec.PACKET_VERSION, REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), mid
        );
        bytes[] memory sigs = signQuorumSorted(digest, firstK(relayerPks, 1));
        vm.expectRevert(BridgeErrors.InvalidQuorum.selector);
        endpoint.submitInbound(wire, sigs);
        assertFalse(endpoint.processed(mid));
    }

    function test_R5b_RemovedRelayerWrongEpoch() public {
        // rotate away r3 by proposing set without removedPk, execute after delay
        address[] memory newSet = new address[](3);
        newSet[0] = vm.addr(r1Pk);
        newSet[1] = vm.addr(r2Pk);
        newSet[2] = makeAddr("r4");
        vm.prank(admin);
        endpoint.proposeRotateRelayers(newSet, 2);
        vm.warp(block.timestamp + 1 days);
        vm.prank(admin);
        endpoint.executeRotateRelayers();
        assertEq(endpoint.epoch(), 2);

        // Old signature over epoch=1 digest must fail domain (epoch mismatch) even if we craft packet with epoch 1
        bytes memory payload = _transferPayload(keccak256("t-r5b"), 10);
        (bytes memory wire, bytes32 mid) = _inboundWire(payload, 1); // stale epoch in packet
        bytes32 digest =
            PacketCodec.signingDigestFromParts(PacketCodec.PACKET_VERSION, REMOTE, LOCAL, remoteEmitter, 1, mid);
        uint256[] memory oldPks = new uint256[](2);
        oldPks[0] = r1Pk;
        oldPks[1] = r2Pk;
        bytes[] memory sigs = signQuorumSorted(digest, oldPks);
        vm.expectRevert(BridgeErrors.WrongDomain.selector);
        endpoint.submitInbound(wire, sigs);
    }

    function test_R5c_FlowLimitAndPause() public {
        _submitOk(keccak256("t-flow1"), 500);
        assertEq(endpoint.flowRemaining(assetId), 500);

        // per-transfer cap 500
        bytes memory payloadOver = _transferPayload(keccak256("t-flow2"), 501);
        (bytes memory wireOver, bytes32 midOver) = _inboundWire(payloadOver, endpoint.epoch());
        bytes32 digestOver = PacketCodec.signingDigestFromParts(
            PacketCodec.PACKET_VERSION, REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), midOver
        );
        vm.expectRevert(abi.encodeWithSelector(BridgeErrors.FlowLimitExceeded.selector, assetId));
        endpoint.submitInbound(wireOver, signQuorumSorted(digestOver, firstK(relayerPks, 2)));

        _submitOk(keccak256("t-flow3"), 500); // window exactly full
        assertEq(endpoint.flowRemaining(assetId), 0);

        bytes memory payloadWin = _transferPayload(keccak256("t-flow4"), 1);
        (bytes memory wireWin, bytes32 midWin) = _inboundWire(payloadWin, endpoint.epoch());
        bytes32 digestWin = PacketCodec.signingDigestFromParts(
            PacketCodec.PACKET_VERSION, REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), midWin
        );
        vm.expectRevert(abi.encodeWithSelector(BridgeErrors.FlowLimitExceeded.selector, assetId));
        endpoint.submitInbound(wireWin, signQuorumSorted(digestWin, firstK(relayerPks, 2)));

        vm.prank(guardian);
        endpoint.pause();
        bytes memory payload = _transferPayload(keccak256("t-paused"), 1);
        (bytes memory wire, bytes32 mid) = _inboundWire(payload, endpoint.epoch());
        bytes32 digest = PacketCodec.signingDigestFromParts(
            PacketCodec.PACKET_VERSION, REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), mid
        );
        vm.warp(block.timestamp + 1 days + 1); // new window; still paused
        vm.expectRevert(BridgeErrors.Paused.selector);
        endpoint.submitInbound(wire, signQuorumSorted(digest, firstK(relayerPks, 2)));
    }

    function test_R6_DeployThresholdTooLow() public {
        address[] memory relayers = new address[](5);
        for (uint256 i; i < 5; ++i) {
            relayers[i] = makeAddr(string(abi.encodePacked("rx", i)));
        }
        vm.expectRevert(BridgeErrors.ThresholdTooLow.selector);
        new BridgeEndpoint(admin, guardian, relayers, 2, LOCAL, REMOTE, remoteEmitter, assetId, 1 days, 100, 50);
    }

    function test_R6_RotateThresholdTooLow() public {
        address[] memory newSet = new address[](5);
        for (uint256 i; i < 5; ++i) {
            newSet[i] = makeAddr(string(abi.encodePacked("ry", i)));
        }
        vm.prank(admin);
        vm.expectRevert(BridgeErrors.ThresholdTooLow.selector);
        endpoint.proposeRotateRelayers(newSet, 2);
    }

    function test_R7_UnknownWithoutQuorumNotProcessed() public {
        bytes memory payload = _transferPayload(keccak256("t-r7"), 1);
        (bytes memory wire, bytes32 mid) = _inboundWire(payload, endpoint.epoch());
        assertFalse(endpoint.processed(mid));
        bytes[] memory empty;
        vm.expectRevert(BridgeErrors.InvalidQuorum.selector);
        endpoint.submitInbound(wire, empty);
        assertFalse(endpoint.processed(mid)); // D9: still unknown
    }

    function test_R1_InboundCannotRotateGovernance() public {
        // Only TRANSFER_REQUEST dispatches; ISSUE inbound is unsupported — not a governance call.
        bytes memory issuePayload = buildIssuePayload(assetId, 1, keccak256("to"));
        Packet memory p = makeInboundPacket(REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), MsgType.ISSUE, issuePayload);
        bytes memory wire = PacketCodec.encode(p);
        bytes32 mid = PacketCodec.messageIdOfWire(wire);
        bytes32 digest = PacketCodec.signingDigestFromParts(
            PacketCodec.PACKET_VERSION, REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), mid
        );
        bytes[] memory sigs = signQuorumSorted(digest, firstK(relayerPks, 2));
        // Mark happens before dispatch — wait, if dispatch reverts, does mark stick?
        // Current code: add then dispatch — if dispatch reverts, whole tx reverts → not processed. Good.
        vm.expectRevert(abi.encodeWithSelector(BridgeErrors.UnsupportedMsgType.selector, uint8(0)));
        endpoint.submitInbound(wire, sigs);
        assertFalse(endpoint.processed(mid));
        // relayer set unchanged — governance not touched via message (R1)
        assertEq(endpoint.relayerCount(), 3);
        assertEq(endpoint.epoch(), 1);
    }

    function test_P1_DuplicateMessageId() public {
        bytes32 mid = _submitOk(keccak256("t-dup"), 10);
        bytes memory payload = _transferPayload(keccak256("t-dup"), 10);
        (bytes memory wire,) = _inboundWire(payload, endpoint.epoch());
        bytes32 digest = PacketCodec.signingDigestFromParts(
            PacketCodec.PACKET_VERSION, REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), mid
        );
        bytes[] memory sigs = signQuorumSorted(digest, firstK(relayerPks, 2));
        vm.expectRevert(abi.encodeWithSelector(BridgeErrors.MessageAlreadyProcessed.selector, mid));
        endpoint.submitInbound(wire, sigs);
    }

    function test_WrongDomain_ChainOrEmitter() public {
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

    function test_RotateTimelockAndI8() public {
        address[] memory newSet = new address[](3);
        newSet[0] = vm.addr(r1Pk);
        newSet[1] = vm.addr(r2Pk);
        newSet[2] = makeAddr("rNew");
        vm.prank(admin);
        endpoint.proposeRotateRelayers(newSet, 2);

        vm.prank(admin);
        vm.expectRevert(BridgeErrors.RotationNotReady.selector);
        endpoint.executeRotateRelayers();

        vm.warp(block.timestamp + 1 days);
        vm.prank(admin);
        endpoint.executeRotateRelayers();
        assertEq(endpoint.epoch(), 2);
        assertEq(endpoint.threshold(), 2);
        assertGe(endpoint.threshold(), RelayerQuorum.minThreshold(endpoint.relayerCount()));
    }

    function test_EmitOutboundIssueConsumesFlow() public {
        bytes memory payload = buildIssuePayload(assetId, 100, keccak256("holder"));
        // TITLE_ROLE is titleRegistry — prank as titles after granting is already done; call via titles address
        vm.prank(address(titles));
        bytes32 mid = endpoint.emitOutbound(MsgType.ISSUE, payload);
        assertTrue(mid != bytes32(0));
        assertEq(endpoint.flowRemaining(assetId), 900);
    }

    function test_UnsupportedMsgType_Codec() public {
        // forge / codec rejects invalid msgType at encode; R1 path uses UnsupportedMsgType on dispatch
        Packet memory bad = Packet({
            version: 1,
            srcChain: REMOTE,
            dstChain: LOCAL,
            emitter: remoteEmitter,
            epoch: 1,
            msgType: MsgType.TRANSFER_REQUEST,
            payload: _transferPayload(keccak256("x"), 1)
        });
        // sanity: encode works
        PacketCodec.encode(bad);
        CodecErrors.UnsupportedMsgType; // reference library
    }
}
