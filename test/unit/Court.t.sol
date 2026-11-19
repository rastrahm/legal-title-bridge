// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Vm} from "forge-std/Vm.sol";

import {MockAttestationRegistry} from "../mocks/MockAttestationRegistry.sol";
import {BridgeEndpoint} from "../../src/BridgeEndpoint.sol";
import {RegistryErrors} from "../../src/errors/RegistryErrors.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {Assertion} from "../../src/interfaces/IIdentityRegistry.sol";
import {ReasonCode, RequestStatus, TitleRegistry} from "../../src/TitleRegistry.sol";
import {MsgType, Packet, PacketCodec} from "../../src/libraries/PacketCodec.sol";
import {BridgePacketHelpers} from "../helpers/BridgePacketHelpers.sol";
import {IdentitySig} from "../helpers/IdentitySig.sol";

/// @notice COURT: forced transfer + P7 cancel, D6 reconcile guards, redeem burn wire, I1.
contract CourtTest is BridgePacketHelpers, IdentitySig {
    BridgeEndpoint internal endpoint;
    TitleRegistry internal titles;
    IdentityRegistry internal identity;
    MockAttestationRegistry internal attestation;

    address internal admin = makeAddr("admin");
    address internal guardian = makeAddr("guardian");
    address internal issuer = makeAddr("issuer");
    address internal operator = makeAddr("operator");
    address internal court = makeAddr("court");

    uint256 internal r1Pk = 0xD01;
    uint256 internal r2Pk = 0xD02;
    uint256 internal r3Pk = 0xD03;
    uint256 internal verifierPk = 0xD11CE;

    uint64 internal constant LOCAL = 31337;
    uint64 internal constant REMOTE = 100001;
    bytes32 internal remoteEmitter = keccak256("solana-program");
    bytes32 internal assetId = keccak256("court-asset");
    bytes32 internal seller = keccak256("seller-sol");
    bytes32 internal buyer = keccak256("buyer-sol");
    bytes32 internal courtDest = keccak256("court-dest-sol");

    function setUp() public {
        address[] memory relayers = new address[](3);
        relayers[0] = vm.addr(r1Pk);
        relayers[1] = vm.addr(r2Pk);
        relayers[2] = vm.addr(r3Pk);

        endpoint = new BridgeEndpoint(admin, guardian, relayers, 2, LOCAL, REMOTE, remoteEmitter, assetId, 1 days, 0, 0);

        identity = new IdentityRegistry(admin, vm.addr(verifierPk));
        attestation = new MockAttestationRegistry();
        titles = new TitleRegistry(admin, issuer, operator, court, address(identity), address(attestation));

        vm.startPrank(admin);
        titles.grantRole(titles.BRIDGE_ROLE(), address(endpoint));
        endpoint.setTitleRegistry(address(titles));
        titles.setBridgeEndpoint(address(endpoint));
        vm.stopPrank();

        _verify(seller);
        _verify(buyer);
        _verify(courtDest);
        attestation.setCertified(assetId, true);
        vm.prank(issuer);
        titles.createAsset(assetId);
        vm.prank(issuer);
        titles.issue(assetId, 100, seller);
    }

    function _verify(bytes32 holder) internal {
        Assertion memory a =
            Assertion({holder: holder, country: 724, investorType: 1, expiry: uint64(block.timestamp + 365 days)});
        identity.registerAssertion(a, signAssertion(identity, verifierPk, a));
    }

    function _registerPending(bytes32 tid, uint256 amount) internal {
        bytes memory payload = buildTransferRequestPayload(
            tid, seller, buyer, amount, keccak256("pay"), 1 ether, uint64(block.timestamp + 1 days), keccak256("travel")
        );
        Packet memory p =
            makeInboundPacket(REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), MsgType.TRANSFER_REQUEST, payload);
        bytes memory wire = PacketCodec.encode(p);
        bytes32 mid = PacketCodec.messageIdOfWire(wire);
        bytes32 digest = PacketCodec.signingDigestFromParts(
            PacketCodec.PACKET_VERSION, REMOTE, LOCAL, remoteEmitter, endpoint.epoch(), mid
        );
        uint256[] memory pks = new uint256[](3);
        pks[0] = r1Pk;
        pks[1] = r2Pk;
        pks[2] = r3Pk;
        endpoint.submitInbound(wire, signQuorumSorted(digest, pks));
    }

    function test_ForcedTransfer_EmitsOutbound_I1() public {
        vm.recordLogs();
        vm.prank(court);
        titles.forcedTransfer(assetId, seller, courtDest, 25, keccak256("res-1"), bytes32(0));

        assertEq(titles.balanceOf(assetId, seller), 75);
        assertEq(titles.balanceOf(assetId, courtDest), 25);
        assertEq(titles.circulating(assetId), 100);
        assertTrue(titles.verifyLedger(assetId));

        bytes32 topic = keccak256("OutboundEmitted(bytes32,uint8,bytes)");
        bool found;
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == address(endpoint) && logs[i].topics[0] == topic) {
                (uint8 mt, bytes memory wire) = abi.decode(logs[i].data, (uint8, bytes));
                assertEq(mt, uint8(MsgType.FORCED_TRANSFER));
                Packet memory pkt = PacketCodec.decode(wire);
                assertEq(pkt.payload.length, 160);
                found = true;
                break;
            }
        }
        assertTrue(found, "FORCED_TRANSFER outbound missing");
    }

    function test_P7_ForcedCancelsPendingRequest() public {
        bytes32 tid = keccak256("p7-pending");
        _registerPending(tid, 40);

        vm.prank(court);
        titles.forcedTransfer(assetId, seller, courtDest, 40, keccak256("p7-res"), tid);

        (,,,,,, RequestStatus status, uint8 reason) = titles.requests(tid);
        assertEq(uint8(status), uint8(RequestStatus.CourtCancelled));
        assertEq(reason, ReasonCode.COURT_ORDER);
        assertEq(titles.balanceOf(assetId, courtDest), 40);
        assertEq(titles.balanceOf(assetId, seller), 60);

        // Cannot decide after court cancel
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.RequestNotPending.selector, tid));
        titles.decide(tid);
    }

    function test_P7_MismatchReverts() public {
        bytes32 tid = keccak256("p7-bad");
        _registerPending(tid, 10);
        // Pending seller is `seller`, but court tries to cancel while moving `buyer`'s units.
        vm.prank(court);
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.RequestMismatch.selector, tid));
        titles.forcedTransfer(assetId, buyer, courtDest, 10, keccak256("r"), tid);
    }

    function test_Reconcile_D6_AndX20() public {
        bytes32 tid = keccak256("d6-rec");
        _registerPending(tid, 20);
        vm.prank(operator);
        titles.decide(tid);
        assertEq(titles.balanceOf(assetId, buyer), 20);

        vm.prank(operator);
        titles.reconcile(tid, keccak256("d6-hash"));
        assertEq(titles.balanceOf(assetId, seller), 100);
        assertEq(titles.balanceOf(assetId, buyer), 0);
        (,,,,,, RequestStatus status,) = titles.requests(tid);
        assertEq(uint8(status), uint8(RequestStatus.Reconciled));

        // X20: cannot reconcile twice
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(RegistryErrors.RequestNotApproved.selector, tid));
        titles.reconcile(tid, keccak256("d6-hash"));
    }

    function test_Reconcile_X21_EmptyHash() public {
        bytes32 tid = keccak256("d6-empty");
        _registerPending(tid, 5);
        vm.prank(operator);
        titles.decide(tid);
        vm.prank(operator);
        vm.expectRevert(RegistryErrors.ZeroAddress.selector);
        titles.reconcile(tid, bytes32(0));
    }

    function test_RedeemInKind_EmitsBurnWire_I1() public {
        uint256 beforeIssued = titles.totalIssued(assetId);
        vm.recordLogs();
        vm.prank(court);
        titles.redeemInKind(assetId, seller, 30, keccak256("burn-res"));

        assertEq(titles.balanceOf(assetId, seller), 70);
        assertEq(titles.totalRedeemed(assetId), 30);
        assertEq(titles.circulating(assetId), beforeIssued - 30);
        assertTrue(titles.verifyLedger(assetId));

        bytes32 topic = keccak256("OutboundEmitted(bytes32,uint8,bytes)");
        bool found;
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == address(endpoint) && logs[i].topics[0] == topic) {
                (uint8 mt, bytes memory wire) = abi.decode(logs[i].data, (uint8, bytes));
                assertEq(mt, uint8(MsgType.FORCED_TRANSFER));
                Packet memory pkt = PacketCodec.decode(wire);
                // to == 0 ⇒ burn on Solana (offset 64 in 160-byte payload)
                bytes32 to;
                bytes memory payload = pkt.payload;
                assembly ("memory-safe") {
                    to := mload(add(add(payload, 0x20), 64))
                }
                assertEq(to, bytes32(0));
                found = true;
                break;
            }
        }
        assertTrue(found, "redeem burn outbound missing");
    }

    function test_Forced_Unauthorized() public {
        vm.prank(operator);
        vm.expectRevert();
        titles.forcedTransfer(assetId, seller, courtDest, 1, keccak256("r"), bytes32(0));
    }
}
