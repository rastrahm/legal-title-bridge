// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @title CodecErrors
/// @notice Custom errors for the Legal Title Bridge packet codec.
library CodecErrors {
    /// @dev Wire buffer too short, bad length, or empty input.
    error InvalidPacket();

    /// @dev `version` is not the supported PACKET_VERSION.
    error UnsupportedVersion(uint8 version);

    /// @dev `msgType` is outside the closed enum.
    error UnsupportedMsgType(uint8 msgType);

    /// @dev Typed payload length does not match the MsgType layout.
    error InvalidPayloadLength(uint8 msgType, uint256 got, uint256 expected);
}
