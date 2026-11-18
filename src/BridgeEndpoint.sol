// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {BridgeErrors} from "./errors/BridgeErrors.sol";
import {IBridgeEndpoint} from "./interfaces/IBridgeEndpoint.sol";
import {TitleRegistry} from "./TitleRegistry.sol";
import {FlowLimiter} from "./libraries/FlowLimiter.sol";
import {MessageIdSet} from "./libraries/MessageIdSet.sol";
import {MsgType, Packet, PacketCodec} from "./libraries/PacketCodec.sol";
import {RelayerQuorum} from "./libraries/RelayerQuorum.sol";

/// @title BridgeEndpoint
/// @notice Quorum-gated inbound packets, typed outbound emit, pause, timelocked relayer rotation (D7–D12).
contract BridgeEndpoint is IBridgeEndpoint, AccessControl {
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant TITLE_ROLE = keccak256("TITLE_ROLE"); // TitleRegistry may emitOutbound

    uint64 public immutable LOCAL_CHAIN_ID;
    uint64 public immutable REMOTE_CHAIN_ID;
    bytes32 public immutable REMOTE_EMITTER;
    uint64 public immutable ROTATION_DELAY;

    /// @notice v1 single-asset bridge key used for TRANSFER_REQUEST flow limits + registry dispatch.
    bytes32 public immutable BRIDGE_ASSET_ID;

    TitleRegistry public titleRegistry;

    address[] private _relayers;
    uint256 public threshold;
    uint64 public epoch;
    bool public paused;

    MessageIdSet.Data private _processed;
    FlowLimiter.Data private _flow;

    struct PendingRotation {
        address[] newRelayers;
        uint256 newThreshold;
        uint64 executeAfter;
        bool pending;
    }

    PendingRotation public pendingRotation;

    event InboundProcessed(bytes32 indexed messageId, MsgType msgType);
    event OutboundEmitted(bytes32 indexed messageId, MsgType msgType, bytes wire);
    event Paused(address indexed guardian);
    event Unpaused(address indexed guardian);
    event RotationProposed(uint256 newThreshold, uint64 executeAfter, uint256 setSize);
    event RotationExecuted(uint64 newEpoch, uint256 newThreshold, uint256 setSize);
    event TitleRegistryUpdated(address indexed titleRegistry);
    event FlowLimitsUpdated(uint256 maxPerWindow, uint256 maxPerTransfer);

    /// @param admin DEFAULT_ADMIN_ROLE (≠ guardian).
    /// @param guardian GUARDIAN_ROLE for pause.
    /// @param relayers_ Initial relayer set (n ≥ 3, unique).
    /// @param threshold_ ≥ ⌈2n/3⌉.
    /// @param localChainId_ This chain id (packet.dstChain for inbound).
    /// @param remoteChainId_ Peer chain id (packet.srcChain for inbound).
    /// @param remoteEmitter_ Expected packet.emitter for inbound.
    /// @param bridgeAssetId_ Asset id for inbound TRANSFER_REQUEST dispatch / flow.
    /// @param rotationDelay_ Timelock seconds before executeRotateRelayers.
    /// @param maxPerWindow Flow window cap (0 = uncapped window).
    /// @param maxPerTransfer Per-transfer cap (0 = uncapped per tx).
    constructor(
        address admin,
        address guardian,
        address[] memory relayers_,
        uint256 threshold_,
        uint64 localChainId_,
        uint64 remoteChainId_,
        bytes32 remoteEmitter_,
        bytes32 bridgeAssetId_,
        uint64 rotationDelay_,
        uint256 maxPerWindow,
        uint256 maxPerTransfer
    ) {
        if (admin == address(0) || guardian == address(0)) {
            revert BridgeErrors.ZeroAddress();
        }
        if (admin == guardian) {
            revert BridgeErrors.RoleOverlap(DEFAULT_ADMIN_ROLE, GUARDIAN_ROLE);
        }
        if (remoteEmitter_ == bytes32(0) || bridgeAssetId_ == bytes32(0)) {
            revert BridgeErrors.ZeroAddress();
        }
        if (localChainId_ == 0 || remoteChainId_ == 0 || localChainId_ == remoteChainId_) {
            revert BridgeErrors.WrongDomain();
        }

        _validateRelayerSet(relayers_, threshold_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, guardian);

        LOCAL_CHAIN_ID = localChainId_;
        REMOTE_CHAIN_ID = remoteChainId_;
        REMOTE_EMITTER = remoteEmitter_;
        BRIDGE_ASSET_ID = bridgeAssetId_;
        ROTATION_DELAY = rotationDelay_;

        _setRelayers(relayers_);
        threshold = threshold_;
        epoch = 1;
        FlowLimiter.configure(_flow, maxPerWindow, maxPerTransfer);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setTitleRegistry(address titleRegistry_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (titleRegistry_ == address(0)) {
            revert BridgeErrors.ZeroAddress();
        }
        if (titleRegistry_.code.length == 0) {
            revert BridgeErrors.EmptyCode(titleRegistry_);
        }
        titleRegistry = TitleRegistry(titleRegistry_);
        _grantRole(TITLE_ROLE, titleRegistry_);
        emit TitleRegistryUpdated(titleRegistry_);
    }

    function setFlowLimits(uint256 maxPerWindow, uint256 maxPerTransfer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        FlowLimiter.configure(_flow, maxPerWindow, maxPerTransfer);
        emit FlowLimitsUpdated(maxPerWindow, maxPerTransfer);
    }

    // -------------------------------------------------------------------------
    // Pause (D12 / R5c)
    // -------------------------------------------------------------------------

    function pause() external onlyRole(GUARDIAN_ROLE) {
        if (paused) {
            revert BridgeErrors.Paused();
        }
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyRole(GUARDIAN_ROLE) {
        if (!paused) {
            revert BridgeErrors.NotPaused();
        }
        paused = false;
        emit Unpaused(msg.sender);
    }

    // -------------------------------------------------------------------------
    // Relayer rotation (D7 / D10 / I8) — never via inbound message (R1)
    // -------------------------------------------------------------------------

    function proposeRotateRelayers(address[] calldata newSet, uint256 newThreshold)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (pendingRotation.pending) {
            revert BridgeErrors.RotationPending();
        }
        _validateRelayerSet(newSet, newThreshold);

        address[] memory copy = new address[](newSet.length);
        for (uint256 i; i < newSet.length; ++i) {
            copy[i] = newSet[i];
        }

        // ROTATION_DELAY and timestamps stay well within uint64 in protocol horizons
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 executeAfter = uint64(block.timestamp + ROTATION_DELAY);
        pendingRotation =
            PendingRotation({newRelayers: copy, newThreshold: newThreshold, executeAfter: executeAfter, pending: true});
        emit RotationProposed(newThreshold, executeAfter, newSet.length);
    }

    function executeRotateRelayers() external onlyRole(DEFAULT_ADMIN_ROLE) {
        PendingRotation storage p = pendingRotation;
        if (!p.pending) {
            revert BridgeErrors.RotationNotPending();
        }
        if (block.timestamp < p.executeAfter) {
            revert BridgeErrors.RotationNotReady();
        }

        _setRelayers(p.newRelayers);
        threshold = p.newThreshold;
        unchecked {
            ++epoch;
        }
        delete pendingRotation;
        emit RotationExecuted(epoch, threshold, _relayers.length);
    }

    // -------------------------------------------------------------------------
    // Inbound / outbound
    // -------------------------------------------------------------------------

    /// @inheritdoc IBridgeEndpoint
    function submitInbound(bytes calldata wire, bytes[] calldata signatures) external {
        if (paused) {
            revert BridgeErrors.Paused();
        }

        Packet memory packet = PacketCodec.decode(wire);
        _requireInboundDomain(packet);

        bytes32 mid = PacketCodec.messageIdOfWire(wire);
        // D9: unknown until quorum + mark; mark before effects (I3)
        bytes32 digest = PacketCodec.signingDigestFromParts(
            packet.version, packet.srcChain, packet.dstChain, packet.emitter, packet.epoch, mid
        );
        RelayerQuorum.requireValid(digest, signatures, _relayers, threshold);

        MessageIdSet.add(_processed, mid);
        _dispatch(packet);
        emit InboundProcessed(mid, packet.msgType);
    }

    /// @inheritdoc IBridgeEndpoint
    function emitOutbound(MsgType msgType, bytes calldata payload)
        external
        onlyRole(TITLE_ROLE)
        returns (bytes32 messageId)
    {
        if (paused) {
            revert BridgeErrors.Paused();
        }
        if (uint8(msgType) > uint8(MsgType.FORCED_TRANSFER)) {
            revert BridgeErrors.UnsupportedMsgType(uint8(msgType));
        }

        Packet memory packet = Packet({
            version: PacketCodec.PACKET_VERSION,
            srcChain: LOCAL_CHAIN_ID,
            dstChain: REMOTE_CHAIN_ID,
            emitter: bytes32(uint256(uint160(address(this)))),
            epoch: epoch,
            msgType: msgType,
            payload: payload
        });
        PacketCodec.requireTypedPayload(packet);

        if (msgType == MsgType.ISSUE || msgType == MsgType.FORCED_TRANSFER) {
            (bytes32 assetId, uint256 amount) = _peekAssetAmount(payload);
            FlowLimiter.checkAndConsume(_flow, assetId, amount);
        }

        bytes memory wire = PacketCodec.encode(packet);
        messageId = PacketCodec.messageIdOfWire(wire);
        emit OutboundEmitted(messageId, msgType, wire);
    }

    /// @inheritdoc IBridgeEndpoint
    function processed(bytes32 messageId) external view returns (bool) {
        return MessageIdSet.contains(_processed, messageId);
    }

    function flowRemaining(bytes32 assetId) external view returns (uint256) {
        return FlowLimiter.remaining(_flow, assetId);
    }

    function relayerCount() external view returns (uint256) {
        return _relayers.length;
    }

    function relayerAt(uint256 index) external view returns (address) {
        return _relayers[index];
    }

    function relayers() external view returns (address[] memory) {
        return _relayers;
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _requireInboundDomain(Packet memory packet) internal view {
        if (packet.version != PacketCodec.PACKET_VERSION) {
            revert BridgeErrors.WrongDomain();
        }
        if (packet.dstChain != LOCAL_CHAIN_ID || packet.srcChain != REMOTE_CHAIN_ID) {
            revert BridgeErrors.WrongDomain();
        }
        if (packet.emitter != REMOTE_EMITTER) {
            revert BridgeErrors.WrongDomain();
        }
        if (packet.epoch != epoch) {
            revert BridgeErrors.WrongDomain();
        }
    }

    function _dispatch(Packet memory packet) internal {
        PacketCodec.requireTypedPayload(packet);

        // Closed enum only — no arbitrary calls (R1 / D8). Governance never reached here.
        if (packet.msgType == MsgType.TRANSFER_REQUEST) {
            _dispatchTransferRequest(packet.payload);
            return;
        }
        // Eth is destination only for TRANSFER_REQUEST in v1; other types are outbound.
        revert BridgeErrors.UnsupportedMsgType(uint8(packet.msgType));
    }

    function _dispatchTransferRequest(bytes memory payload) internal {
        if (address(titleRegistry) == address(0)) {
            revert BridgeErrors.ZeroAddress();
        }

        bytes32 transferId;
        bytes32 seller;
        bytes32 buyer;
        uint256 amount;
        uint64 deadline;
        assembly ("memory-safe") {
            let p := add(payload, 0x20)
            transferId := mload(p)
            seller := mload(add(p, 32))
            buyer := mload(add(p, 64))
            amount := mload(add(p, 96))
            deadline := shr(192, mload(add(p, 192)))
        }

        FlowLimiter.checkAndConsume(_flow, BRIDGE_ASSET_ID, amount);
        titleRegistry.onTransferRequest(transferId, BRIDGE_ASSET_ID, seller, buyer, amount, deadline);
    }

    function _peekAssetAmount(bytes memory payload) internal pure returns (bytes32 assetId, uint256 amount) {
        assembly ("memory-safe") {
            let p := add(payload, 0x20)
            assetId := mload(p)
            amount := mload(add(p, 32))
        }
    }

    function _validateRelayerSet(address[] memory set, uint256 threshold_) internal pure {
        uint256 n = set.length;
        RelayerQuorum.requireThreshold(n, threshold_);
        for (uint256 i; i < n; ++i) {
            if (set[i] == address(0)) {
                revert BridgeErrors.ZeroAddress();
            }
            for (uint256 j = i + 1; j < n; ++j) {
                if (set[i] == set[j]) {
                    revert BridgeErrors.InvalidRelayerSet();
                }
            }
        }
    }

    function _setRelayers(address[] memory set) internal {
        delete _relayers;
        uint256 n = set.length;
        for (uint256 i; i < n; ++i) {
            _relayers.push(set[i]);
        }
    }
}
