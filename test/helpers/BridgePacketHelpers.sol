// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test} from "forge-std/Test.sol";

import {MsgType, Packet, PacketCodec} from "../../src/libraries/PacketCodec.sol";

/// @title BridgePacketHelpers
/// @notice Packet builders + sorted relayer signatures for BridgeEndpoint tests.
abstract contract BridgePacketHelpers is Test {
    function buildTransferRequestPayload(
        bytes32 transferId,
        bytes32 seller,
        bytes32 buyer,
        uint256 amount,
        bytes32 paymentMint,
        uint256 paymentAmount,
        uint64 deadline,
        bytes32 travelRuleHash
    ) internal pure returns (bytes memory payload) {
        payload = new bytes(232);
        assembly ("memory-safe") {
            let p := add(payload, 0x20)
            mstore(p, transferId)
            mstore(add(p, 32), seller)
            mstore(add(p, 64), buyer)
            mstore(add(p, 96), amount)
            mstore(add(p, 128), paymentMint)
            mstore(add(p, 160), paymentAmount)
            mstore(add(p, 192), shl(192, deadline))
            mstore(add(p, 200), travelRuleHash)
        }
    }

    function buildIssuePayload(bytes32 assetId, uint256 amount, bytes32 toHolder)
        internal
        pure
        returns (bytes memory payload)
    {
        payload = abi.encodePacked(assetId, bytes32(amount), toHolder);
    }

    function makeInboundPacket(
        uint64 srcChain,
        uint64 dstChain,
        bytes32 emitter,
        uint64 epoch,
        MsgType msgType,
        bytes memory payload
    ) internal pure returns (Packet memory) {
        return Packet({
            version: PacketCodec.PACKET_VERSION,
            srcChain: srcChain,
            dstChain: dstChain,
            emitter: emitter,
            epoch: epoch,
            msgType: msgType,
            payload: payload
        });
    }

    /// @notice Sign digest with `pks`, return signatures ordered by ascending recovered address.
    function signQuorumSorted(bytes32 digest, uint256[] memory pks) internal pure returns (bytes[] memory sigs) {
        uint256 n = pks.length;
        address[] memory addrs = new address[](n);
        bytes[] memory raw = new bytes[](n);
        for (uint256 i; i < n; ++i) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(pks[i], digest);
            raw[i] = abi.encodePacked(r, s, v);
            addrs[i] = vm.addr(pks[i]);
        }
        // insertion sort by address
        for (uint256 i = 1; i < n; ++i) {
            address keyA = addrs[i];
            bytes memory keyS = raw[i];
            uint256 j = i;
            while (j > 0 && uint160(addrs[j - 1]) > uint160(keyA)) {
                addrs[j] = addrs[j - 1];
                raw[j] = raw[j - 1];
                unchecked {
                    --j;
                }
            }
            addrs[j] = keyA;
            raw[j] = keyS;
        }
        sigs = raw;
    }

    function firstK(uint256[] memory pks, uint256 k) internal pure returns (uint256[] memory out) {
        out = new uint256[](k);
        for (uint256 i; i < k; ++i) {
            out[i] = pks[i];
        }
    }
}
