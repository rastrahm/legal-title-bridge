// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @title BridgeErrors
/// @notice Custom errors for BridgeEndpoint and related libraries.
library BridgeErrors {
    error ZeroAddress();
    error Unauthorized();
    error InvalidQuorum();
    error WrongDomain();
    error UnknownMessage();
    error MessageAlreadyProcessed(bytes32 messageId);
    error UnsupportedMsgType(uint8 msgType);
    error FlowLimitExceeded(bytes32 assetId);
    error ThresholdTooLow();
    error EmptyCode(address target);
    error Paused();
    error NotPaused();
    error RotationNotPending();
    error RotationNotReady();
    error RotationPending();
    error InvalidRelayerSet();
    error DuplicateSignature(address signer);
    error RoleOverlap(bytes32 roleA, bytes32 roleB);
}
