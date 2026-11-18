// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test} from "forge-std/Test.sol";

import {BridgeEndpoint} from "../../src/BridgeEndpoint.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {TitleRegistry} from "../../src/TitleRegistry.sol";
import {RelayerQuorum} from "../../src/libraries/RelayerQuorum.sol";
import {MockAttestationRegistry} from "../mocks/MockAttestationRegistry.sol";
import {BridgeEndpointHandler} from "./BridgeEndpointHandler.sol";

/// @title BridgeEndpointInvariants
/// @notice I3: message id ≤ once; I8: threshold ≥ ⌈2n/3⌉ and n ≥ 3.
contract BridgeEndpointInvariants is Test {
    BridgeEndpoint internal endpoint;
    BridgeEndpointHandler internal handler;

    address internal admin = makeAddr("admin");
    address internal guardian = makeAddr("guardian");

    uint256 internal r1Pk = 0xA01;
    uint256 internal r2Pk = 0xA02;
    uint256 internal r3Pk = 0xA03;

    uint64 internal constant LOCAL = 31337;
    uint64 internal constant REMOTE = 100001;
    bytes32 internal remoteEmitter = keccak256("solana-program");
    bytes32 internal assetId = keccak256("inv-bridge-asset");

    function setUp() public {
        address[] memory relayers = new address[](3);
        relayers[0] = vm.addr(r1Pk);
        relayers[1] = vm.addr(r2Pk);
        relayers[2] = vm.addr(r3Pk);

        endpoint = new BridgeEndpoint(
            admin, guardian, relayers, 2, LOCAL, REMOTE, remoteEmitter, assetId, 1 hours, 10_000, 100
        );

        IdentityRegistry identity = new IdentityRegistry(admin, makeAddr("verifier"));
        MockAttestationRegistry attestation = new MockAttestationRegistry();
        TitleRegistry titles = new TitleRegistry(
            admin, makeAddr("issuer"), makeAddr("operator"), makeAddr("court"), address(identity), address(attestation)
        );

        vm.startPrank(admin);
        titles.grantRole(titles.BRIDGE_ROLE(), address(endpoint));
        endpoint.setTitleRegistry(address(titles));
        vm.stopPrank();

        vm.prank(makeAddr("issuer"));
        titles.createAsset(assetId);
        attestation.setCertified(assetId, true);

        handler = new BridgeEndpointHandler(endpoint, admin, remoteEmitter, LOCAL, REMOTE, r1Pk, r2Pk, r3Pk);

        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = BridgeEndpointHandler.submitTransfer.selector;
        selectors[1] = BridgeEndpointHandler.proposeValidRotation.selector;
        selectors[2] = BridgeEndpointHandler.executeRotation.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_I3_NoDoubleProcess() public view {
        assertEq(handler.ghostDoubleProcess(), 0);
    }

    function invariant_I8_Threshold() public view {
        uint256 n = endpoint.relayerCount();
        assertGe(n, 3);
        assertGe(endpoint.threshold(), RelayerQuorum.minThreshold(n));
        assertLe(endpoint.threshold(), n);
    }
}
