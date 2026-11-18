// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test} from "forge-std/Test.sol";

import {BridgeEndpoint} from "../../src/BridgeEndpoint.sol";
import {MsgType, Packet, PacketCodec} from "../../src/libraries/PacketCodec.sol";
import {RelayerQuorum} from "../../src/libraries/RelayerQuorum.sol";

/// @title BridgeEndpointHandler
/// @notice Bounded caller for I3 (idempotency) and I8 (threshold) invariants.
contract BridgeEndpointHandler is Test {
    BridgeEndpoint public immutable ENDPOINT;
    address public immutable ADMIN;
    bytes32 public immutable REMOTE_EMITTER;
    uint64 public immutable LOCAL;
    uint64 public immutable REMOTE;

    uint256 public immutable R1_PK;
    uint256 public immutable R2_PK;
    uint256 public immutable R3_PK;

    uint256 public ghostDoubleProcess;
    uint256 public calls;
    uint256 public submitAttempts;

    constructor(
        BridgeEndpoint endpoint_,
        address admin_,
        bytes32 remoteEmitter_,
        uint64 local_,
        uint64 remote_,
        uint256 r1Pk_,
        uint256 r2Pk_,
        uint256 r3Pk_
    ) {
        ENDPOINT = endpoint_;
        ADMIN = admin_;
        REMOTE_EMITTER = remoteEmitter_;
        LOCAL = local_;
        REMOTE = remote_;
        R1_PK = r1Pk_;
        R2_PK = r2Pk_;
        R3_PK = r3Pk_;
    }

    function submitTransfer(uint256 salt, uint256 amount) external {
        ++calls;
        ++submitAttempts;
        amount = bound(amount, 1, 50);
        bytes32 transferId = keccak256(abi.encode("inv", salt, calls));
        bytes32 seller = keccak256("seller");
        bytes32 buyer = keccak256("buyer");
        bytes32 pay = keccak256("pay");
        bytes32 travel = keccak256("travel");
        // casting to uint64 is safe for fuzz horizons in this suite
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 deadline = uint64(block.timestamp + 1 days);

        bytes memory payload = new bytes(232);
        assembly ("memory-safe") {
            let p := add(payload, 0x20)
            mstore(p, transferId)
            mstore(add(p, 32), seller)
            mstore(add(p, 64), buyer)
            mstore(add(p, 96), amount)
            mstore(add(p, 128), pay)
            mstore(add(p, 160), amount)
            mstore(add(p, 192), shl(192, deadline))
            mstore(add(p, 200), travel)
        }

        Packet memory packet = Packet({
            version: PacketCodec.PACKET_VERSION,
            srcChain: REMOTE,
            dstChain: LOCAL,
            emitter: REMOTE_EMITTER,
            epoch: ENDPOINT.epoch(),
            msgType: MsgType.TRANSFER_REQUEST,
            payload: payload
        });
        bytes memory wire = PacketCodec.encode(packet);
        bytes32 mid = PacketCodec.messageIdOfWire(wire);
        bool already = ENDPOINT.processed(mid);

        bytes32 digest = PacketCodec.signingDigestFromParts(
            packet.version, packet.srcChain, packet.dstChain, packet.emitter, packet.epoch, mid
        );

        uint256[] memory pks = new uint256[](2);
        pks[0] = R1_PK;
        pks[1] = R2_PK;
        // sort by address
        if (uint160(vm.addr(pks[0])) > uint160(vm.addr(pks[1]))) {
            (pks[0], pks[1]) = (pks[1], pks[0]);
        }
        bytes[] memory sigs = new bytes[](2);
        for (uint256 i; i < 2; ++i) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(pks[i], digest);
            sigs[i] = abi.encodePacked(r, s, v);
        }

        try ENDPOINT.submitInbound(wire, sigs) {
            if (already) {
                ++ghostDoubleProcess;
            }
        } catch {
            // expected on pause / flow / duplicate
        }

        // intentional duplicate attempt (I3)
        try ENDPOINT.submitInbound(wire, sigs) {
            ++ghostDoubleProcess;
        } catch {}
    }

    function proposeValidRotation(uint256 seed) external {
        ++calls;
        address[] memory set = new address[](3);
        set[0] = vm.addr(R1_PK);
        set[1] = vm.addr(R2_PK);
        set[2] = address(uint160(uint256(keccak256(abi.encode(seed, "r"))) | 1));
        if (set[2] == set[0] || set[2] == set[1] || set[2] == ADMIN) {
            set[2] = makeAddr("rot-alt");
        }
        uint256 thr = RelayerQuorum.minThreshold(3);
        vm.prank(ADMIN);
        try ENDPOINT.proposeRotateRelayers(set, thr) {} catch {}
    }

    function executeRotation() external {
        ++calls;
        // public struct getter omits dynamic `newRelayers` array
        (uint256 newThreshold, uint64 executeAfter, bool pending) = ENDPOINT.pendingRotation();
        newThreshold;
        if (!pending) {
            return;
        }
        if (block.timestamp < executeAfter) {
            vm.warp(executeAfter);
        }
        vm.prank(ADMIN);
        try ENDPOINT.executeRotateRelayers() {} catch {}
    }
}
