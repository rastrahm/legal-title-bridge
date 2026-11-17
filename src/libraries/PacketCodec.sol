// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {CodecErrors} from "../errors/CodecErrors.sol";

/// @notice Closed message type enum (D8).
enum MsgType {
    ISSUE,
    TRANSFER_REQUEST,
    TRANSFER_DECISION,
    FORCED_TRANSFER
}

/// @notice Cross-chain packet header + opaque payload (wire layout in PROTOCOLO).
struct Packet {
    uint8 version;
    uint64 srcChain;
    uint64 dstChain;
    bytes32 emitter;
    uint64 epoch;
    MsgType msgType;
    bytes payload;
}

/// @title PacketCodec
/// @notice Canonical encode/decode, messageId and signingDigest for LTB v1.
/// @dev Wire is big-endian packed; must match codec.rs and shared/codec.ts (C5).
library PacketCodec {
    uint8 internal constant PACKET_VERSION = 1;
    uint256 internal constant HEADER_SIZE = 62;

    /// @notice Domain tag used in signingDigest (D11).
    /// @dev keccak256("LegalTitleBridge.Packet.v1")
    function domainTag() internal pure returns (bytes32) {
        return keccak256(bytes("LegalTitleBridge.Packet.v1"));
    }

    /// @notice Encodes a packet to canonical wire bytes.
    /// @param packet Packet to encode.
    /// @return data Canonical wire encoding.
    function encode(Packet memory packet) internal pure returns (bytes memory data) {
        if (packet.version != PACKET_VERSION) {
            revert CodecErrors.UnsupportedVersion(packet.version);
        }
        uint8 mt = uint8(packet.msgType);
        if (mt > uint8(MsgType.FORCED_TRANSFER)) {
            revert CodecErrors.UnsupportedMsgType(mt);
        }

        uint256 payloadLen = packet.payload.length;
        if (payloadLen > type(uint32).max) {
            revert CodecErrors.InvalidPacket();
        }

        data = new bytes(HEADER_SIZE + payloadLen);
        bytes memory payload = packet.payload;
        uint8 version = packet.version;
        uint64 srcChain = packet.srcChain;
        uint64 dstChain = packet.dstChain;
        bytes32 emitter = packet.emitter;
        uint64 epoch = packet.epoch;

        // Write fixed-width big-endian fields without overflowing the 62-byte header.
        assembly ("memory-safe") {
            let dest := add(data, 0x20)
            mstore8(dest, version)

            mstore(0x00, shl(192, srcChain))
            mcopy(add(dest, 1), 0x00, 8)

            mstore(0x00, shl(192, dstChain))
            mcopy(add(dest, 9), 0x00, 8)

            mstore(add(dest, 17), emitter)

            mstore(0x00, shl(192, epoch))
            mcopy(add(dest, 49), 0x00, 8)

            mstore8(add(dest, 57), mt)

            mstore(0x00, shl(224, payloadLen))
            mcopy(add(dest, 58), 0x00, 4)

            if payloadLen {
                mcopy(add(dest, HEADER_SIZE), add(payload, 0x20), payloadLen)
            }
        }
    }

    /// @notice Decodes canonical wire bytes into a packet.
    /// @param data Wire bytes.
    /// @return packet Decoded packet.
    function decode(bytes memory data) internal pure returns (Packet memory packet) {
        if (data.length < HEADER_SIZE) {
            revert CodecErrors.InvalidPacket();
        }

        uint8 version;
        uint64 srcChain;
        uint64 dstChain;
        bytes32 emitter;
        uint64 epoch;
        uint8 mt;
        uint32 payloadLen;

        assembly ("memory-safe") {
            let p := add(data, 0x20)
            version := byte(0, mload(p))
            srcChain := shr(192, mload(add(p, 1)))
            dstChain := shr(192, mload(add(p, 9)))
            emitter := mload(add(p, 17))
            epoch := shr(192, mload(add(p, 49)))
            mt := byte(0, mload(add(p, 57)))
            payloadLen := shr(224, mload(add(p, 58)))
        }

        if (version != PACKET_VERSION) {
            revert CodecErrors.UnsupportedVersion(version);
        }
        if (mt > uint8(MsgType.FORCED_TRANSFER)) {
            revert CodecErrors.UnsupportedMsgType(mt);
        }
        if (data.length != HEADER_SIZE + uint256(payloadLen)) {
            revert CodecErrors.InvalidPacket();
        }

        bytes memory payload = new bytes(payloadLen);
        if (payloadLen > 0) {
            assembly ("memory-safe") {
                mcopy(add(payload, 0x20), add(add(data, 0x20), HEADER_SIZE), payloadLen)
            }
        }

        packet = Packet({
            version: version,
            srcChain: srcChain,
            dstChain: dstChain,
            emitter: emitter,
            epoch: epoch,
            msgType: MsgType(mt),
            payload: payload
        });
    }

    /// @notice messageId = keccak256(wire).
    /// @param packet Packet to hash.
    /// @return id Message id.
    function messageId(Packet memory packet) internal pure returns (bytes32 id) {
        return keccak256(encode(packet));
    }

    /// @notice messageId from already-encoded wire bytes.
    /// @param wire Canonical encoding.
    /// @return id Message id.
    function messageIdOfWire(bytes memory wire) internal pure returns (bytes32 id) {
        return keccak256(wire);
    }

    /// @notice Relayer signing digest (D11).
    /// @param packet Packet whose id is bound into the digest.
    /// @return digest 32-byte digest to sign.
    function signingDigest(Packet memory packet) internal pure returns (bytes32 digest) {
        bytes32 mid = messageId(packet);
        return
            signingDigestFromParts(packet.version, packet.srcChain, packet.dstChain, packet.emitter, packet.epoch, mid);
    }

    /// @notice Builds signing digest from domain fields + messageId.
    function signingDigestFromParts(
        uint8 version,
        uint64 srcChain,
        uint64 dstChain,
        bytes32 emitter,
        uint64 epoch,
        bytes32 mid
    ) internal pure returns (bytes32 digest) {
        bytes32 tag = domainTag();
        bytes memory buf = new bytes(121);
        assembly ("memory-safe") {
            let dest := add(buf, 0x20)
            mstore(dest, tag)
            mstore8(add(dest, 32), version)

            mstore(0x00, shl(192, srcChain))
            mcopy(add(dest, 33), 0x00, 8)

            mstore(0x00, shl(192, dstChain))
            mcopy(add(dest, 41), 0x00, 8)

            mstore(add(dest, 49), emitter)

            mstore(0x00, shl(192, epoch))
            mcopy(add(dest, 81), 0x00, 8)

            mstore(add(dest, 89), mid)
        }
        return keccak256(buf);
    }

    /// @notice Expected payload length for a typed message (0 if opaque/unknown).
    function expectedPayloadLength(MsgType msgType) internal pure returns (uint256) {
        if (msgType == MsgType.ISSUE) {
            return 96;
        }
        if (msgType == MsgType.TRANSFER_REQUEST) {
            return 232;
        }
        if (msgType == MsgType.TRANSFER_DECISION) {
            return 66;
        }
        if (msgType == MsgType.FORCED_TRANSFER) {
            return 160;
        }
        return 0;
    }

    /// @notice Reverts if payload length does not match MsgType layout.
    function requireTypedPayload(Packet memory packet) internal pure {
        uint256 expected = expectedPayloadLength(packet.msgType);
        if (packet.payload.length != expected) {
            revert CodecErrors.InvalidPayloadLength(uint8(packet.msgType), packet.payload.length, expected);
        }
    }
}
