// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {MsgType, Packet, PacketCodec} from "../../src/libraries/PacketCodec.sol";

/// @title PacketCodecHarness
/// @notice External wrappers so unit tests can call the library.
contract PacketCodecHarness {
    function encode(Packet memory packet) external pure returns (bytes memory) {
        return PacketCodec.encode(packet);
    }

    function decode(bytes memory data) external pure returns (Packet memory) {
        return PacketCodec.decode(data);
    }

    function messageId(Packet memory packet) external pure returns (bytes32) {
        return PacketCodec.messageId(packet);
    }

    function messageIdOfWire(bytes memory wire) external pure returns (bytes32) {
        return PacketCodec.messageIdOfWire(wire);
    }

    function signingDigest(Packet memory packet) external pure returns (bytes32) {
        return PacketCodec.signingDigest(packet);
    }

    function domainTag() external pure returns (bytes32) {
        return PacketCodec.domainTag();
    }

    function requireTypedPayload(Packet memory packet) external pure {
        PacketCodec.requireTypedPayload(packet);
    }

    function expectedPayloadLength(MsgType msgType) external pure returns (uint256) {
        return PacketCodec.expectedPayloadLength(msgType);
    }
}
