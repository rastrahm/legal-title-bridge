// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test} from "forge-std/Test.sol";
import {Smoke} from "../../src/Smoke.sol";

/// @title SmokeTest
/// @notice BOOT smoke test: compiles and passes under solc 0.8.37.
contract SmokeTest is Test {
    Smoke internal smoke;

    function setUp() public {
        smoke = new Smoke();
    }

    function test_Version() public view {
        assertEq(smoke.VERSION(), "boot-0");
    }

    function test_Add() public view {
        assertEq(smoke.add(2, 3), 5);
    }

    function testFuzz_Add(uint128 a, uint128 b) public view {
        assertEq(smoke.add(a, b), uint256(a) + uint256(b));
    }
}
