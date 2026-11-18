// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {BridgeErrors} from "../../src/errors/BridgeErrors.sol";
import {RelayerQuorum} from "../../src/libraries/RelayerQuorum.sol";
import {BridgePacketHelpers} from "../helpers/BridgePacketHelpers.sol";

contract RelayerQuorumTest is BridgePacketHelpers {
    function test_MinThreshold() public pure {
        assertEq(RelayerQuorum.minThreshold(3), 2);
        assertEq(RelayerQuorum.minThreshold(4), 3);
        assertEq(RelayerQuorum.minThreshold(5), 4);
        assertEq(RelayerQuorum.minThreshold(6), 4);
    }

    function test_RequireThresholdOk() public pure {
        RelayerQuorum.requireThreshold(3, 2);
        RelayerQuorum.requireThreshold(5, 4);
    }

    function test_RequireThresholdTooLow_R6() public {
        vm.expectRevert(BridgeErrors.ThresholdTooLow.selector);
        this._requireThreshold(5, 2); // Harmony-style 2-of-5
    }

    function _requireThreshold(uint256 n, uint256 t) external pure {
        RelayerQuorum.requireThreshold(n, t);
    }

    function test_RequireThresholdNLessThan3() public {
        vm.expectRevert(BridgeErrors.ThresholdTooLow.selector);
        this._requireThreshold(2, 2);
    }

    function test_VerifyExactAndMore() public {
        uint256 pk1 = 0xB1;
        uint256 pk2 = 0xB2;
        uint256 pk3 = 0xB3;
        address[] memory set = new address[](3);
        set[0] = vm.addr(pk1);
        set[1] = vm.addr(pk2);
        set[2] = vm.addr(pk3);

        bytes32 digest = keccak256("hello");
        uint256[] memory all = new uint256[](3);
        all[0] = pk1;
        all[1] = pk2;
        all[2] = pk3;

        bytes[] memory two = signQuorumSorted(digest, firstK(all, 2));
        assertTrue(RelayerQuorum.verify(digest, two, set, 2));

        bytes[] memory three = signQuorumSorted(digest, all);
        assertTrue(RelayerQuorum.verify(digest, three, set, 2));
        assertTrue(RelayerQuorum.verify(digest, three, set, 3));
    }

    function test_VerifyInsufficient_R5a() public {
        uint256 pk1 = 0xC1;
        uint256 pk2 = 0xC2;
        uint256 pk3 = 0xC3;
        address[] memory set = new address[](3);
        set[0] = vm.addr(pk1);
        set[1] = vm.addr(pk2);
        set[2] = vm.addr(pk3);

        bytes32 digest = keccak256("r5a");
        uint256[] memory all = new uint256[](3);
        all[0] = pk1;
        all[1] = pk2;
        all[2] = pk3;
        bytes[] memory one = signQuorumSorted(digest, firstK(all, 1));
        assertFalse(RelayerQuorum.verify(digest, one, set, 2));
    }

    function test_VerifyStrangerRejected() public {
        uint256 pk1 = 0xD1;
        uint256 pk2 = 0xD2;
        uint256 pk3 = 0xD3;
        uint256 stranger = 0xDEAD;
        address[] memory set = new address[](3);
        set[0] = vm.addr(pk1);
        set[1] = vm.addr(pk2);
        set[2] = vm.addr(pk3);

        bytes32 digest = keccak256("stranger");
        uint256[] memory pks = new uint256[](2);
        pks[0] = pk1;
        pks[1] = stranger;
        bytes[] memory sigs = signQuorumSorted(digest, pks);
        assertFalse(RelayerQuorum.verify(digest, sigs, set, 2));
    }
}
