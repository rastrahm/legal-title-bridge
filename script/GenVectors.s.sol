// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Script} from "forge-std/Script.sol";

/// @title GenVectors
/// @notice Thin wrapper: golden vectors are written by `GenVectorsTest.test_WriteGoldenVectors`.
/// @dev Use: `forge test --match-test test_WriteGoldenVectors -vv` → test/vectors/packets.json
contract GenVectors is Script {
    /// @notice Documents the generator entrypoint for Makefiles / CI.
    function run() external pure returns (string memory hint) {
        hint = "forge test --match-test test_WriteGoldenVectors -vv";
    }
}
