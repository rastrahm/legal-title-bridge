// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test} from "forge-std/Test.sol";

import {LedgerChain} from "../../src/libraries/LedgerChain.sol";

contract LedgerChainTest is Test {
    function test_NextHashChains() public pure {
        bytes32 d0 = keccak256("a");
        bytes32 d1 = keccak256("b");
        bytes32 e0 = LedgerChain.nextHash(bytes32(0), d0);
        bytes32 e1 = LedgerChain.nextHash(e0, d1);
        assertTrue(e0 != e1);
        assertTrue(e0 != bytes32(0));
    }

    function test_VerifyChainOk() public pure {
        bytes32[] memory data = new bytes32[](3);
        data[0] = keccak256("x");
        data[1] = keccak256("y");
        data[2] = keccak256("z");
        bytes32[] memory entries = new bytes32[](3);
        bytes32 prev = bytes32(0);
        for (uint256 i; i < 3; ++i) {
            entries[i] = LedgerChain.nextHash(prev, data[i]);
            prev = entries[i];
        }
        assertTrue(LedgerChain.verifyChain(entries, data));
    }

    function test_VerifyChainBroken() public pure {
        bytes32[] memory data = new bytes32[](2);
        data[0] = keccak256("x");
        data[1] = keccak256("y");
        bytes32[] memory entries = new bytes32[](2);
        entries[0] = LedgerChain.nextHash(bytes32(0), data[0]);
        entries[1] = bytes32(uint256(1)); // broken link
        assertFalse(LedgerChain.verifyChain(entries, data));
    }

    function testFuzz_Chain(bytes32 a, bytes32 b, bytes32 c) public pure {
        bytes32[] memory data = new bytes32[](3);
        data[0] = a;
        data[1] = b;
        data[2] = c;
        bytes32[] memory entries = new bytes32[](3);
        bytes32 prev = bytes32(0);
        for (uint256 i; i < 3; ++i) {
            entries[i] = LedgerChain.nextHash(prev, data[i]);
            prev = entries[i];
        }
        assertTrue(LedgerChain.verifyChain(entries, data));
    }
}
