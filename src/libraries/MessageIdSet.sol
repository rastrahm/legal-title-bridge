// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {BridgeErrors} from "../errors/BridgeErrors.sol";

/// @title MessageIdSet
/// @notice Idempotency set for inbound message ids (I3 / P1).
library MessageIdSet {
    struct Data {
        mapping(bytes32 messageId => bool seen) seen;
    }

    function contains(Data storage self, bytes32 messageId) internal view returns (bool) {
        return self.seen[messageId];
    }

    /// @notice Marks `messageId` processed; reverts if already seen.
    function add(Data storage self, bytes32 messageId) internal {
        if (messageId == bytes32(0)) {
            revert BridgeErrors.UnknownMessage();
        }
        if (self.seen[messageId]) {
            revert BridgeErrors.MessageAlreadyProcessed(messageId);
        }
        self.seen[messageId] = true;
    }
}
