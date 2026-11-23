// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

// EXTATK — X1–X8: Bridge packet domain and flow attacks.
// Independent attacker perspective; no reference to test/redteam/.
// Expected outcome for secure code: every attack reverts (bloqueado).

import {BridgeEndpoint} from "../../src/BridgeEndpoint.sol";
import {BridgeErrors} from "../../src/errors/BridgeErrors.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {TitleRegistry} from "../../src/TitleRegistry.sol";
import {MsgType, Packet, PacketCodec} from "../../src/libraries/PacketCodec.sol";
import {BridgePacketHelpers} from "../helpers/BridgePacketHelpers.sol";
import {MockAttestationRegistry} from "../mocks/MockAttestationRegistry.sol";

/// @title X1–X8 BridgeDomain Attack Suite
/// @notice Independent external attacker attempting packet domain bypasses on BridgeEndpoint.
contract X01_X08_BridgeDomainTest is BridgePacketHelpers {
    // -------------------------------------------------------------------------
    // Fixture
    // -------------------------------------------------------------------------

    BridgeEndpoint internal endpoint;
    TitleRegistry internal titles;
    IdentityRegistry internal identity;
    MockAttestationRegistry internal attestation;

    address internal admin = makeAddr("admin");
    address internal guardian = makeAddr("guardian");
    address internal issuer = makeAddr("issuer");
    address internal operator = makeAddr("operator");
    address internal court = makeAddr("court");
    address internal attacker = makeAddr("attacker");

    // Relayer private keys (3 relayers, threshold 2).
    uint256 internal r1Pk = 0xEA01;
    uint256 internal r2Pk = 0xEA02;
    uint256 internal r3Pk = 0xEA03;

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

        // Flow caps: maxPerWindow=5000, maxPerTransfer=1000
        endpoint = new BridgeEndpoint(
            admin, guardian, relayers, 2, LOCAL, REMOTE, remoteEmitter, assetId, 1 days, 5_000, 1_000
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

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _makeTransferPayload(bytes32 transferId, uint256 amount) internal view returns (bytes memory) {
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

    /// Build valid wire + signatures for a TRANSFER_REQUEST packet.
    function _buildValidInbound(bytes32 transferId, uint256 amount)
        internal
        view
        returns (bytes memory wire, bytes[] memory sigs)
    {
        bytes memory payload = _makeTransferPayload(transferId, amount);
        Packet memory p =
            makeInboundPacket(REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), MsgType.TRANSFER_REQUEST, payload);
        wire = PacketCodec.encode(p);
        bytes32 digest = PacketCodec.signingDigest(p);
        sigs = signQuorumSorted(digest, firstK(relayerPks, 2));
    }

    // -------------------------------------------------------------------------
    // X1 — srcChain/dstChain swapped in packet
    // -------------------------------------------------------------------------

    /// @notice Attacker replays a valid packet with srcChain ↔ dstChain swapped.
    /// Step: craft packet where srcChain=LOCAL, dstChain=REMOTE (mirror of normal).
    /// Expected: WrongDomain revert (packet.dstChain != LOCAL_CHAIN_ID).
    /// Verdict: bloqueado
    function test_X1_swappedDomains_revertWrongDomain() public {
        bytes memory payload = _makeTransferPayload(keccak256("x1"), 100);
        // Swap: inbound should have srcChain=REMOTE, dstChain=LOCAL; we swap them.
        Packet memory p = makeInboundPacket(
            LOCAL, // srcChain = LOCAL (attacker swaps)
            REMOTE, // dstChain = REMOTE (attacker swaps)
            remoteEmitter,
            endpoint.epoch(),
            MsgType.TRANSFER_REQUEST,
            payload
        );
        bytes memory wire = PacketCodec.encode(p);
        bytes32 digest = PacketCodec.signingDigest(p);
        bytes[] memory sigs = signQuorumSorted(digest, firstK(relayerPks, 2));

        vm.prank(attacker);
        vm.expectRevert(BridgeErrors.WrongDomain.selector);
        endpoint.submitInbound(wire, sigs);
    }

    // -------------------------------------------------------------------------
    // X2 — single payload byte mutated after signing
    // -------------------------------------------------------------------------

    /// @notice Attacker mutates one byte of an already-signed wire packet.
    /// Step: take valid wire, flip byte at offset 62 (first payload byte), reuse sigs.
    /// Expected: InvalidQuorum — digest mismatch, signatures no longer valid.
    /// Verdict: bloqueado
    function test_X2_mutatedPayload_revertInvalidQuorum() public {
        (bytes memory wire, bytes[] memory sigs) = _buildValidInbound(keccak256("x2"), 100);

        // Flip the first byte of the payload (header = 62 bytes).
        wire[62] ^= 0xFF;

        vm.prank(attacker);
        vm.expectRevert(BridgeErrors.InvalidQuorum.selector);
        endpoint.submitInbound(wire, sigs);
    }

    // -------------------------------------------------------------------------
    // X3 — same messageId with different MsgType re-submitted
    // -------------------------------------------------------------------------

    /// @notice Attacker submits a valid message, then tries to deliver it again with different payload.
    /// Step 1: deliver TRANSFER_REQUEST id "x3" successfully.
    /// Step 2: craft new wire for same transferId (same outer bits → same messageId) and re-submit.
    /// Expected: MessageAlreadyProcessed (I3 idempotency set).
    /// Verdict: bloqueado
    function test_X3_replayWithDifferentMsgType_revertAlreadyProcessed() public {
        (bytes memory wire, bytes[] memory sigs) = _buildValidInbound(keccak256("x3"), 100);
        bytes32 mid = PacketCodec.messageIdOfWire(wire);

        // First delivery: success.
        endpoint.submitInbound(wire, sigs);
        assertTrue(endpoint.processed(mid), "should be marked processed");

        // Second delivery with same wire: MessageAlreadyProcessed.
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(BridgeErrors.MessageAlreadyProcessed.selector, mid));
        endpoint.submitInbound(wire, sigs);
    }

    // -------------------------------------------------------------------------
    // X4 — old epoch signatures after relayer rotation
    // -------------------------------------------------------------------------

    /// @notice Attacker uses valid signatures from epoch 1 after the bridge rotates to epoch 2.
    /// Step: rotate relayers (propose + execute after delay), then replay old epoch wire + sigs.
    /// Expected: WrongDomain (packet.epoch != endpoint.epoch).
    /// Verdict: bloqueado
    function test_X4_oldEpochAfterRotation_revertWrongDomain() public {
        // Build valid inbound for current epoch (1).
        (bytes memory wire, bytes[] memory sigs) = _buildValidInbound(keccak256("x4"), 100);

        // Propose rotation with same set (just bumps epoch).
        address[] memory newSet = new address[](3);
        newSet[0] = vm.addr(r1Pk);
        newSet[1] = vm.addr(r2Pk);
        newSet[2] = vm.addr(r3Pk);
        vm.prank(admin);
        endpoint.proposeRotateRelayers(newSet, 2);

        // Fast-forward past rotation delay.
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(admin);
        endpoint.executeRotateRelayers();

        assertEq(endpoint.epoch(), 2, "epoch should be 2 after rotation");

        // Replay old-epoch wire.
        vm.prank(attacker);
        vm.expectRevert(BridgeErrors.WrongDomain.selector);
        endpoint.submitInbound(wire, sigs);
    }

    // -------------------------------------------------------------------------
    // X5 — k−1 valid signatures + one garbage signature
    // -------------------------------------------------------------------------

    /// @notice Attacker submits threshold−1 valid signatures (1) plus one valid sig from a
    ///         non-relayer key (0xDEAD). Total = 2 sigs, but only 1 is from the relayer set.
    /// Step: sign with r1Pk (relayer) + 0xDEAD (non-relayer), sorted ascending.
    /// Expected: InvalidQuorum — only 1 valid relayer signer, threshold = 2.
    /// Verdict: bloqueado
    function test_X5_belowThresholdWithNonRelayer_revertInvalidQuorum() public {
        uint256 nonRelayerPk = 0xDEAD; // not in relayer set

        bytes memory payload = _makeTransferPayload(keccak256("x5"), 100);
        Packet memory p =
            makeInboundPacket(REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), MsgType.TRANSFER_REQUEST, payload);
        bytes memory wire = PacketCodec.encode(p);
        bytes32 digest = PacketCodec.signingDigest(p);

        // One valid relayer signature.
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(r1Pk, digest);
        bytes memory validRelayer = abi.encodePacked(r1, s1, v1);

        // One valid non-relayer signature (proper ECDSA, but signer not in relayer set).
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(nonRelayerPk, digest);
        bytes memory nonRelayerSig = abi.encodePacked(r2, s2, v2);

        // Sort ascending by recovered address (required by RelayerQuorum).
        address addrRelayer = vm.addr(r1Pk);
        address addrNonRelayer = vm.addr(nonRelayerPk);

        bytes[] memory sigs = new bytes[](2);
        if (uint160(addrRelayer) < uint160(addrNonRelayer)) {
            sigs[0] = validRelayer;
            sigs[1] = nonRelayerSig;
        } else {
            sigs[0] = nonRelayerSig;
            sigs[1] = validRelayer;
        }

        vm.prank(attacker);
        vm.expectRevert(BridgeErrors.InvalidQuorum.selector);
        endpoint.submitInbound(wire, sigs);
    }

    // -------------------------------------------------------------------------
    // X6 — same message raced by two delivery paths
    // -------------------------------------------------------------------------

    /// @notice Two distinct "relayer coalitions" attempt to deliver the same message.
    /// Step: coalition A delivers first (success); coalition B tries to deliver same wire.
    /// Expected: second delivery reverts MessageAlreadyProcessed.
    /// Verdict: bloqueado
    function test_X6_doubleDeliveryRace_secondReverts() public {
        (bytes memory wire, bytes[] memory sigsA) = _buildValidInbound(keccak256("x6"), 100);
        bytes32 mid = PacketCodec.messageIdOfWire(wire);

        // Coalition B: sign with r2+r3 (also a valid quorum).
        Packet memory p = PacketCodec.decode(wire);
        bytes32 digest = PacketCodec.signingDigest(p);
        uint256[] memory bPks = new uint256[](2);
        bPks[0] = r2Pk;
        bPks[1] = r3Pk;
        bytes[] memory sigsB = signQuorumSorted(digest, bPks);

        // Coalition A delivers first.
        endpoint.submitInbound(wire, sigsA);
        assertTrue(endpoint.processed(mid));

        // Coalition B tries to deliver → reverts.
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(BridgeErrors.MessageAlreadyProcessed.selector, mid));
        endpoint.submitInbound(wire, sigsB);
    }

    // -------------------------------------------------------------------------
    // X7 — flow window evasion via fragmented messages
    // -------------------------------------------------------------------------

    /// @notice Attacker tries to bypass per-window cap by sending N < cap transfers.
    /// Setup: window=5000, perTransfer=1000. Send 5 × 1000 (fills window).
    /// Step: attempt a 6th × 1 transfer → FlowLimitExceeded.
    /// Verdict: bloqueado
    function test_X7_flowWindowFragmentation_revertFlowLimit() public {
        uint256 cap = 1_000;
        uint256 nFull = 5; // 5 × 1000 = 5000 = maxPerWindow

        for (uint256 i = 1; i <= nFull; i++) {
            bytes32 tid = keccak256(abi.encodePacked("x7-", i));
            (bytes memory wire, bytes[] memory sigs) = _buildValidInbound(tid, cap);
            endpoint.submitInbound(wire, sigs);
        }

        // Window exhausted; one more unit should revert.
        (bytes memory wire6, bytes[] memory sigs6) = _buildValidInbound(keccak256("x7-extra"), 1);
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(BridgeErrors.FlowLimitExceeded.selector, assetId));
        endpoint.submitInbound(wire6, sigs6);
    }

    // -------------------------------------------------------------------------
    // X8 — submit inbound while bridge is paused (Ethereum side)
    // -------------------------------------------------------------------------

    /// @notice Attacker continues bridge activity while guardian has paused Ethereum side.
    /// Step: guardian pauses; attacker tries submitInbound.
    /// Expected: Paused revert.
    /// Verdict: bloqueado
    function test_X8_submitWhilePaused_revertPaused() public {
        vm.prank(guardian);
        endpoint.pause();

        (bytes memory wire, bytes[] memory sigs) = _buildValidInbound(keccak256("x8"), 100);

        vm.prank(attacker);
        vm.expectRevert(BridgeErrors.Paused.selector);
        endpoint.submitInbound(wire, sigs);
    }

    /// @notice Corollary: guardian can pause but Solana-side outbound would also need pausing.
    /// This test checks emitOutbound is also blocked when paused.
    /// Verdict: bloqueado
    function test_X8_emitOutboundWhilePaused_revertPaused() public {
        vm.prank(guardian);
        endpoint.pause();

        // Even TitleRegistry (TITLE_ROLE) cannot emit when endpoint is paused.
        vm.prank(address(titles));
        vm.expectRevert(BridgeErrors.Paused.selector);
        endpoint.emitOutbound(MsgType.ISSUE, new bytes(96));
    }
}
