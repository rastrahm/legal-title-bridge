// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {MockAttestationRegistry} from "../mocks/MockAttestationRegistry.sol";
import {BridgeEndpoint} from "../../src/BridgeEndpoint.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {TitleRegistry} from "../../src/TitleRegistry.sol";
import {MsgType, Packet, PacketCodec} from "../../src/libraries/PacketCodec.sol";
import {BridgePacketHelpers} from "../helpers/BridgePacketHelpers.sol";
import {VulnerableBridgeEndpoint} from "./vulnerable/VulnerableBridgeEndpoint.sol";

/// @title RedteamBase
/// @notice Shared deploy + packet helpers for positive-control vs real BridgeEndpoint tests.
abstract contract RedteamBase is BridgePacketHelpers {
    BridgeEndpoint internal endpoint;
    TitleRegistry internal titles;
    IdentityRegistry internal identity;
    MockAttestationRegistry internal attestation;
    VulnerableBridgeEndpoint internal vuln;

    address internal admin = makeAddr("admin");
    address internal guardian = makeAddr("guardian");
    address internal issuer = makeAddr("issuer");
    address internal operator = makeAddr("operator");
    address internal court = makeAddr("court");

    uint256 internal r1Pk = 0xA01;
    uint256 internal r2Pk = 0xA02;
    uint256 internal r3Pk = 0xA03;

    uint64 internal constant LOCAL = 31337;
    uint64 internal constant REMOTE = 100001;
    bytes32 internal remoteEmitter = keccak256("solana-program");
    bytes32 internal assetId = keccak256("bridge-asset");

    uint256[] internal relayerPks;
    address[] internal relayerAddrs;

    function setUp() public virtual {
        relayerPks = new uint256[](3);
        relayerPks[0] = r1Pk;
        relayerPks[1] = r2Pk;
        relayerPks[2] = r3Pk;

        relayerAddrs = new address[](3);
        relayerAddrs[0] = vm.addr(r1Pk);
        relayerAddrs[1] = vm.addr(r2Pk);
        relayerAddrs[2] = vm.addr(r3Pk);

        endpoint = new BridgeEndpoint(
            admin, guardian, relayerAddrs, 2, LOCAL, REMOTE, remoteEmitter, assetId, 1 days, 1_000, 500
        );

        identity = new IdentityRegistry(admin, makeAddr("verifier"));
        attestation = new MockAttestationRegistry();
        titles = new TitleRegistry(admin, issuer, operator, court, address(identity), address(attestation));

        vm.startPrank(admin);
        titles.grantRole(titles.BRIDGE_ROLE(), address(endpoint));
        endpoint.setTitleRegistry(address(titles));
        vm.stopPrank();

        vm.prank(issuer);
        titles.createAsset(assetId);
        attestation.setCertified(assetId, true);

        // Vulnerable: Harmony-style 2-of-5 allowed at construct.
        address[] memory five = new address[](5);
        five[0] = relayerAddrs[0];
        five[1] = relayerAddrs[1];
        five[2] = relayerAddrs[2];
        five[3] = makeAddr("r4");
        five[4] = makeAddr("r5");
        vuln = new VulnerableBridgeEndpoint(five, 2);
    }

    function _transferPayload(bytes32 transferId, uint256 amount) internal view returns (bytes memory) {
        return buildTransferRequestPayload(
            transferId,
            keccak256("seller"),
            keccak256("buyer"),
            amount,
            keccak256("pay-mint"),
            1 ether,
            uint64(block.timestamp + 1 days),
            keccak256("travel")
        );
    }

    function _inboundWire(bytes memory payload, uint64 epoch) internal view returns (bytes memory wire, bytes32 mid) {
        Packet memory p = makeInboundPacket(REMOTE, LOCAL, remoteEmitter, epoch, MsgType.TRANSFER_REQUEST, payload);
        wire = PacketCodec.encode(p);
        mid = PacketCodec.messageIdOfWire(wire);
    }

    function _digest(bytes32 mid, uint64 epoch) internal view returns (bytes32) {
        return PacketCodec.signingDigestFromParts(PacketCodec.PACKET_VERSION, REMOTE, LOCAL, remoteEmitter, epoch, mid);
    }
}
