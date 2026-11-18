// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {BridgeErrors} from "../errors/BridgeErrors.sol";

/// @title FlowLimiter
/// @notice Per-asset rolling window + per-transfer caps (D12 / R5c).
library FlowLimiter {
    uint256 internal constant WINDOW = 1 days;

    struct Data {
        uint256 maxPerWindow;
        uint256 maxPerTransfer;
        mapping(bytes32 assetId => uint256 windowStart) windowStart;
        mapping(bytes32 assetId => uint256 consumed) consumed;
    }

    function configure(Data storage self, uint256 maxPerWindow_, uint256 maxPerTransfer_) internal {
        self.maxPerWindow = maxPerWindow_;
        self.maxPerTransfer = maxPerTransfer_;
    }

    function remaining(Data storage self, bytes32 assetId) internal view returns (uint256) {
        uint256 start = self.windowStart[assetId];
        if (start == 0 || block.timestamp >= start + WINDOW) {
            return self.maxPerWindow;
        }
        uint256 used = self.consumed[assetId];
        if (used >= self.maxPerWindow) {
            return 0;
        }
        return self.maxPerWindow - used;
    }

    /// @notice Consumes `amount` against the asset window; reverts on overflow of caps.
    function checkAndConsume(Data storage self, bytes32 assetId, uint256 amount) internal {
        if (amount == 0) {
            revert BridgeErrors.FlowLimitExceeded(assetId);
        }
        if (self.maxPerTransfer != 0 && amount > self.maxPerTransfer) {
            revert BridgeErrors.FlowLimitExceeded(assetId);
        }

        uint256 start = self.windowStart[assetId];
        if (start == 0 || block.timestamp >= start + WINDOW) {
            self.windowStart[assetId] = block.timestamp;
            self.consumed[assetId] = 0;
        }

        uint256 used = self.consumed[assetId] + amount;
        if (self.maxPerWindow != 0 && used > self.maxPerWindow) {
            revert BridgeErrors.FlowLimitExceeded(assetId);
        }
        self.consumed[assetId] = used;
    }
}
