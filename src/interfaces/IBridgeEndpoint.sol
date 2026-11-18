// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {MsgType} from "../libraries/PacketCodec.sol";

/// @title IBridgeEndpoint
/// @notice Ethereum bridge endpoint: quorum inbound, typed outbound, pause, timelocked rotation.
interface IBridgeEndpoint {
    function submitInbound(bytes calldata wire, bytes[] calldata signatures) external;

    function emitOutbound(MsgType msgType, bytes calldata payload) external returns (bytes32 messageId);

    function processed(bytes32 messageId) external view returns (bool);

    function pause() external;

    function unpause() external;

    function proposeRotateRelayers(address[] calldata newSet, uint256 newThreshold) external;

    function executeRotateRelayers() external;
}
