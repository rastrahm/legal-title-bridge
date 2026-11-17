// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @title Smoke
/// @notice BOOT smoke placeholder (replaced in later phases).
/// @dev Exists only to validate solc 0.8.37 + Cancun + Foundry toolchain.
contract Smoke {
    /// @notice Module smoke version string.
    string public constant VERSION = "boot-0";

    /// @notice Adds two integers (BOOT TDD demo).
    /// @param a First addend.
    /// @param b Second addend.
    /// @return c Sum of a and b.
    function add(uint256 a, uint256 b) external pure returns (uint256 c) {
        c = a + b;
    }
}
