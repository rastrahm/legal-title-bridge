// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {CodecErrors} from "../../src/errors/CodecErrors.sol";
import {MsgType, Packet} from "../../src/libraries/PacketCodec.sol";
import {PacketCodecHarness} from "../helpers/PacketCodecHarness.sol";

/// @title PacketCodecTest
/// @notice Unit, fuzz and golden-vector checks for the LTB packet codec (C5).
contract PacketCodecTest is Test {
    using stdJson for string;

    PacketCodecHarness internal harness;
    /// @dev Storage sink so golden-vector test is not flagged as view (solc Warning 2018).
    uint256 internal sink;

    function setUp() public {
        harness = new PacketCodecHarness();
    }

    function _issuePayload() internal pure returns (bytes memory) {
        bytes memory p = new bytes(96);
        assembly ("memory-safe") {
            mstore(add(p, 0x20), 0x1111111111111111111111111111111111111111111111111111111111111111)
            mstore(add(p, 0x40), 1000)
            mstore(add(p, 0x60), 0x2222222222222222222222222222222222222222222222222222222222222222)
        }
        return p;
    }

    function _sample() internal pure returns (Packet memory) {
        return Packet({
            version: 1,
            srcChain: 31337,
            dstChain: 100001,
            emitter: bytes32(uint256(uint160(address(0xE111)))),
            epoch: 1,
            msgType: MsgType.ISSUE,
            payload: _issuePayload()
        });
    }

    function test_domainTag_matchesSpecString() public view {
        assertEq(harness.domainTag(), keccak256(bytes("LegalTitleBridge.Packet.v1")));
    }

    function test_encodeDecode_roundtrip() public view {
        Packet memory p = _sample();
        Packet memory d = harness.decode(harness.encode(p));
        assertEq(d.version, p.version);
        assertEq(d.srcChain, p.srcChain);
        assertEq(d.dstChain, p.dstChain);
        assertEq(d.emitter, p.emitter);
        assertEq(d.epoch, p.epoch);
        assertEq(uint8(d.msgType), uint8(p.msgType));
        assertEq(d.payload, p.payload);
    }

    function test_encode_headerSizeAndPayloadLen() public view {
        Packet memory p = _sample();
        bytes memory wire = harness.encode(p);
        assertEq(wire.length, 62 + p.payload.length);
        assertEq(uint8(wire[0]), 1);
        assertEq(uint8(wire[57]), uint8(MsgType.ISSUE));
    }

    function test_messageId_stableAndSensitive() public view {
        Packet memory p = _sample();
        bytes32 a = harness.messageId(p);
        assertEq(a, harness.messageIdOfWire(harness.encode(p)));
        p.epoch = 2;
        assertTrue(harness.messageId(p) != a);
    }

    function test_signingDigest_bindsDomainAndMessageId() public view {
        Packet memory p = _sample();
        bytes32 d1 = harness.signingDigest(p);
        p.emitter = bytes32(uint256(1));
        assertTrue(harness.signingDigest(p) != d1);
    }

    function test_decode_revertsOnShort() public {
        vm.expectRevert(CodecErrors.InvalidPacket.selector);
        harness.decode(hex"01");
    }

    function test_decode_revertsOnBadVersion() public {
        Packet memory p = _sample();
        bytes memory wire = harness.encode(p);
        wire[0] = 0x02;
        vm.expectRevert(abi.encodeWithSelector(CodecErrors.UnsupportedVersion.selector, uint8(2)));
        harness.decode(wire);
    }

    function test_decode_revertsOnBadMsgType() public {
        Packet memory p = _sample();
        bytes memory wire = harness.encode(p);
        wire[57] = 0x09;
        vm.expectRevert(abi.encodeWithSelector(CodecErrors.UnsupportedMsgType.selector, uint8(9)));
        harness.decode(wire);
    }

    function test_decode_revertsOnLengthMismatch() public {
        Packet memory p = _sample();
        bytes memory wire = harness.encode(p);
        bytes memory bad = new bytes(wire.length - 1);
        for (uint256 i; i < bad.length; ++i) {
            bad[i] = wire[i];
        }
        vm.expectRevert(CodecErrors.InvalidPacket.selector);
        harness.decode(bad);
    }

    function test_requireTypedPayload_okAndFail() public {
        Packet memory p = _sample();
        harness.requireTypedPayload(p);
        p.payload = hex"00";
        vm.expectRevert();
        harness.requireTypedPayload(p);
    }

    function testFuzz_roundtrip(
        uint64 srcChain,
        uint64 dstChain,
        bytes32 emitter,
        uint64 epoch,
        uint8 msgTypeRaw,
        bytes memory payload
    ) public view {
        MsgType mt = MsgType(uint8(bound(msgTypeRaw, 0, 3)));
        // Keep payloads moderate for fuzz speed
        if (payload.length > 512) {
            bytes memory trimmed = new bytes(512);
            for (uint256 i; i < 512; ++i) {
                trimmed[i] = payload[i];
            }
            payload = trimmed;
        }
        Packet memory p = Packet({
            version: 1,
            srcChain: srcChain,
            dstChain: dstChain,
            emitter: emitter,
            epoch: epoch,
            msgType: mt,
            payload: payload
        });
        Packet memory d = harness.decode(harness.encode(p));
        assertEq(d.srcChain, srcChain);
        assertEq(d.dstChain, dstChain);
        assertEq(d.emitter, emitter);
        assertEq(d.epoch, epoch);
        assertEq(uint8(d.msgType), uint8(mt));
        assertEq(d.payload, payload);
    }

    function test_goldenVectors_matchJson() public {
        sink = 1; // keep function non-view for forge lint / solc
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/test/vectors/packets.json");
        if (!vm.exists(path)) {
            return; // GenVectors not run yet
        }

        string memory raw = vm.readFile(path);
        uint256 n = raw.readUint(".count");
        for (uint256 i; i < n; ++i) {
            string memory base = string.concat(".vectors[", vm.toString(i), "]");
            bytes memory wire = raw.readBytes(string.concat(base, ".wire"));
            bytes32 expectedId = raw.readBytes32(string.concat(base, ".messageId"));
            bytes32 expectedDigest = raw.readBytes32(string.concat(base, ".signingDigest"));

            Packet memory p = harness.decode(wire);
            assertEq(harness.encode(p), wire, "wire roundtrip");
            assertEq(harness.messageIdOfWire(wire), expectedId, "messageId");
            assertEq(harness.signingDigest(p), expectedDigest, "signingDigest");
        }
    }
}
