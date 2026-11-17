// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test, console2} from "forge-std/Test.sol";

import {MsgType, Packet, PacketCodec} from "../../src/libraries/PacketCodec.sol";

/// @title GenVectorsTest
/// @notice Generates golden vectors via forge test (C5). Run: forge test --match-test test_WriteGoldenVectors -vv
contract GenVectorsTest is Test {
    function test_WriteGoldenVectors() public {
        string memory outPath = string.concat(vm.projectRoot(), "/test/vectors/packets.json");
        string memory json = _buildJson();
        vm.writeFile(outPath, json);
        console2.log("Wrote", outPath);
        assertTrue(vm.exists(outPath));
    }

    function _buildJson() internal pure returns (string memory) {
        Packet memory p0 = _issueBasic();
        Packet memory p1 = _issueZeroAmount();
        Packet memory p2 = _issueMaxAmount();
        Packet memory p3 = _transferRequest();
        Packet memory p4 = _decision(0, 0);
        Packet memory p5 = _decision(1, 1);
        Packet memory p6 = _decision(2, 0);
        Packet memory p7 = _forcedZeroKeys();

        string memory json = "{\"version\":\"1\",";
        json = string.concat(json, "\"domainTagString\":\"LegalTitleBridge.Packet.v1\",");
        json = string.concat(json, "\"domainTag\":\"", _b32(PacketCodec.domainTag()), "\",");
        json = string.concat(json, "\"count\":8,\"vectors\":[");
        json = string.concat(json, _vec("issue_basic", p0), ",");
        json = string.concat(json, _vec("issue_zero_amount", p1), ",");
        json = string.concat(json, _vec("issue_max_amount", p2), ",");
        json = string.concat(json, _vec("transfer_request_basic", p3), ",");
        json = string.concat(json, _vec("transfer_decision_approved", p4), ",");
        json = string.concat(json, _vec("transfer_decision_rejected", p5), ",");
        json = string.concat(json, _vec("transfer_decision_expired", p6), ",");
        json = string.concat(json, _vec("forced_transfer_zero_keys", p7));
        json = string.concat(json, "]}");
        return json;
    }

    function _vec(string memory name, Packet memory p) internal pure returns (string memory) {
        bytes memory wire = PacketCodec.encode(p);
        bytes32 mid = PacketCodec.messageIdOfWire(wire);
        bytes32 digest = PacketCodec.signingDigest(p);
        return string.concat(
            "{\"name\":\"",
            name,
            "\",\"version\":",
            _u(p.version),
            ",\"srcChain\":\"",
            _u(p.srcChain),
            "\",\"dstChain\":\"",
            _u(p.dstChain),
            "\",\"emitter\":\"",
            _b32(p.emitter),
            "\",\"epoch\":\"",
            _u(p.epoch),
            "\",\"msgType\":",
            _u(uint8(p.msgType)),
            ",\"payload\":\"",
            _bytes(p.payload),
            "\",\"wire\":\"",
            _bytes(wire),
            "\",\"messageId\":\"",
            _b32(mid),
            "\",\"signingDigest\":\"",
            _b32(digest),
            "\"}"
        );
    }

    function _issueBasic() internal pure returns (Packet memory) {
        return Packet({
            version: 1,
            srcChain: 31337,
            dstChain: 100001,
            emitter: bytes32(uint256(uint160(address(0xE111)))),
            epoch: 1,
            msgType: MsgType.ISSUE,
            payload: _issuePayload(bytes32(uint256(0xA1)), 1000, bytes32(uint256(0xB1)))
        });
    }

    function _issueZeroAmount() internal pure returns (Packet memory) {
        Packet memory p = _issueBasic();
        p.payload = _issuePayload(bytes32(uint256(0xA1)), 0, bytes32(uint256(0xB1)));
        return p;
    }

    function _issueMaxAmount() internal pure returns (Packet memory) {
        Packet memory p = _issueBasic();
        p.payload = _issuePayload(bytes32(type(uint256).max), type(uint256).max, bytes32(type(uint256).max));
        return p;
    }

    function _transferRequest() internal pure returns (Packet memory) {
        bytes memory payload = new bytes(232);
        _writeBytes32(payload, 0, bytes32(uint256(0x71)));
        _writeBytes32(payload, 32, bytes32(uint256(0x51)));
        _writeBytes32(payload, 64, bytes32(uint256(0x52)));
        _writeBytes32(payload, 96, bytes32(uint256(500)));
        _writeBytes32(payload, 128, bytes32(uint256(0x91)));
        _writeBytes32(payload, 160, bytes32(uint256(900)));
        _writeU64(payload, 192, 1_700_000_000);
        _writeBytes32(payload, 200, bytes32(uint256(0x81)));
        return Packet({
            version: 1,
            srcChain: 100001,
            dstChain: 31337,
            emitter: bytes32(uint256(0x501)),
            epoch: 3,
            msgType: MsgType.TRANSFER_REQUEST,
            payload: payload
        });
    }

    function _decision(uint8 outcome, uint8 reason) internal pure returns (Packet memory) {
        bytes memory payload = new bytes(66);
        _writeBytes32(payload, 0, bytes32(uint256(0x71)));
        payload[32] = bytes1(outcome);
        payload[33] = bytes1(reason);
        _writeBytes32(payload, 34, bytes32(uint256(500)));
        return Packet({
            version: 1,
            srcChain: 31337,
            dstChain: 100001,
            emitter: bytes32(uint256(uint160(address(0xE111)))),
            epoch: 3,
            msgType: MsgType.TRANSFER_DECISION,
            payload: payload
        });
    }

    function _forcedZeroKeys() internal pure returns (Packet memory) {
        return Packet({
            version: 1,
            srcChain: 31337,
            dstChain: 100002,
            emitter: bytes32(0),
            epoch: 0,
            msgType: MsgType.FORCED_TRANSFER,
            payload: new bytes(160)
        });
    }

    function _issuePayload(bytes32 assetId, uint256 amount, bytes32 toHolder)
        internal
        pure
        returns (bytes memory payload)
    {
        payload = new bytes(96);
        _writeBytes32(payload, 0, assetId);
        _writeBytes32(payload, 32, bytes32(amount));
        _writeBytes32(payload, 64, toHolder);
    }

    function _writeBytes32(bytes memory buf, uint256 offset, bytes32 value) internal pure {
        assembly ("memory-safe") {
            mstore(add(add(buf, 0x20), offset), value)
        }
    }

    function _writeU64(bytes memory buf, uint256 offset, uint64 value) internal pure {
        assembly ("memory-safe") {
            mstore(0x00, shl(192, value))
            mcopy(add(add(buf, 0x20), offset), 0x00, 8)
        }
    }

    function _u(uint256 v) internal pure returns (string memory) {
        if (v == 0) {
            return "0";
        }
        uint256 temp = v;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (v != 0) {
            digits -= 1;
            // casting to 'uint8' is safe because digit is 0-9
            // forge-lint: disable-next-line(unsafe-typecast)
            buffer[digits] = bytes1(uint8(48 + uint256(v % 10)));
            v /= 10;
        }
        return string(buffer);
    }

    function _b32(bytes32 v) internal pure returns (string memory) {
        return _bytes(abi.encodePacked(v));
    }

    function _bytes(bytes memory data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < data.length; i++) {
            str[2 + i * 2] = alphabet[uint8(data[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }
}
