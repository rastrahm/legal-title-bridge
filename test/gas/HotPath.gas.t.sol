// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {MockAttestationRegistry} from "../mocks/MockAttestationRegistry.sol";
import {BridgeEndpoint} from "../../src/BridgeEndpoint.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {Assertion} from "../../src/interfaces/IIdentityRegistry.sol";
import {DecisionOutcome, TitleRegistry} from "../../src/TitleRegistry.sol";
import {MsgType, Packet, PacketCodec} from "../../src/libraries/PacketCodec.sol";
import {BridgePacketHelpers} from "../helpers/BridgePacketHelpers.sol";
import {IdentitySig} from "../helpers/IdentitySig.sol";

/**
 * @title HotPathGasTest
 * @notice Baseline gas for registry + bridge hot paths (`forge snapshot --match-contract HotPathGasTest`).
 * @dev Prep lives in `setUp` so snapshot numbers reflect the measured call only.
 */
contract HotPathGasTest is BridgePacketHelpers, IdentitySig {
    BridgeEndpoint internal endpoint;
    TitleRegistry internal titles;
    IdentityRegistry internal identity;
    MockAttestationRegistry internal attestation;

    address internal admin = makeAddr("admin");
    address internal guardian = makeAddr("guardian");
    address internal issuer = makeAddr("issuer");
    address internal operator = makeAddr("operator");
    address internal court = makeAddr("court");

    uint256 internal r1Pk = 0xE01;
    uint256 internal r2Pk = 0xE02;
    uint256 internal r3Pk = 0xE03;
    uint256 internal verifierPk = 0xE11CE;

    uint64 internal constant LOCAL = 31337;
    uint64 internal constant REMOTE = 100001;
    bytes32 internal remoteEmitter = keccak256("solana-program");
    bytes32 internal assetId = keccak256("gas-asset");
    bytes32 internal seller = keccak256("seller-sol");
    bytes32 internal buyer = keccak256("buyer-sol");

    uint256[] internal relayerPks;
    bytes32 internal pendingDecideId = keccak256("gas-decide");

    function setUp() public {
        relayerPks = new uint256[](3);
        relayerPks[0] = r1Pk;
        relayerPks[1] = r2Pk;
        relayerPks[2] = r3Pk;

        address[] memory relayers = new address[](3);
        relayers[0] = vm.addr(r1Pk);
        relayers[1] = vm.addr(r2Pk);
        relayers[2] = vm.addr(r3Pk);

        // Window 10_000 / per-transfer 1_000 — enough headroom for happy-path gas.
        endpoint = new BridgeEndpoint(
            admin, guardian, relayers, 2, LOCAL, REMOTE, remoteEmitter, assetId, 1 days, 10_000, 1_000
        );

        identity = new IdentityRegistry(admin, vm.addr(verifierPk));
        attestation = new MockAttestationRegistry();
        titles = new TitleRegistry(admin, issuer, operator, court, address(identity), address(attestation));

        vm.startPrank(admin);
        endpoint.setTitleRegistry(address(titles));
        titles.setBridgeEndpoint(address(endpoint));
        vm.stopPrank();

        _verify(seller);
        _verify(buyer);
        attestation.setCertified(assetId, true);
        vm.prank(issuer);
        titles.createAsset(assetId);

        // Inventory + pending request for decide; rotation proposed for execute path.
        vm.prank(issuer);
        titles.issue(assetId, 100, seller);
        _submitInbound(pendingDecideId, 10);

        address[] memory newSet = new address[](3);
        newSet[0] = vm.addr(r1Pk);
        newSet[1] = vm.addr(r2Pk);
        newSet[2] = makeAddr("rNew");
        vm.prank(admin);
        endpoint.proposeRotateRelayers(newSet, 2);
        vm.warp(block.timestamp + 1 days);
    }

    function _verify(bytes32 holder) internal {
        Assertion memory a =
            Assertion({holder: holder, country: 724, investorType: 1, expiry: uint64(block.timestamp + 365 days)});
        identity.registerAssertion(a, signAssertion(identity, verifierPk, a));
    }

    function _submitInbound(bytes32 transferId, uint256 amount) internal {
        bytes memory payload = buildTransferRequestPayload(
            transferId,
            seller,
            buyer,
            amount,
            keccak256("pay"),
            1 ether,
            uint64(block.timestamp + 1 days),
            keccak256("travel")
        );
        Packet memory p =
            makeInboundPacket(REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), MsgType.TRANSFER_REQUEST, payload);
        bytes memory wire = PacketCodec.encode(p);
        bytes32 mid = PacketCodec.messageIdOfWire(wire);
        bytes32 digest = PacketCodec.signingDigestFromParts(
            PacketCodec.PACKET_VERSION, REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), mid
        );
        endpoint.submitInbound(wire, signQuorumSorted(digest, firstK(relayerPks, 2)));
    }

    /// @dev Issue + outbound ISSUE (flow consume) to a second verified holder.
    function testGas_issue() public {
        vm.prank(issuer);
        titles.issue(assetId, 50, buyer);
    }

    function testGas_submitInbound() public {
        _submitInbound(keccak256("gas-inbound"), 10);
    }

    function testGas_decide() public {
        vm.prank(operator);
        DecisionOutcome outcome = titles.decide(pendingDecideId);
        assertEq(uint8(outcome), uint8(DecisionOutcome.Approved));
    }

    function testGas_rotate() public {
        vm.prank(admin);
        endpoint.executeRotateRelayers();
    }

    /// @dev Happy-path flow consume via outbound ISSUE (same limiter as inbound).
    function testGas_flowLimitConsume() public {
        bytes memory payload = buildIssuePayload(assetId, 100, seller);
        vm.prank(address(titles));
        endpoint.emitOutbound(MsgType.ISSUE, payload);
    }
}
