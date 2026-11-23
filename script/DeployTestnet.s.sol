// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Script, console2} from "forge-std/Script.sol";

import {AttestationRegistry} from "../src/AttestationRegistry.sol";
import {BridgeEndpoint} from "../src/BridgeEndpoint.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {TitleRegistry} from "../src/TitleRegistry.sol";

/// @title DeployTestnet
/// @notice Deploys Identity + Attestation + Title + BridgeEndpoint for Sepolia (TESTNET).
/// @dev Env (all required):
///   ADMIN GUARDIAN ISSUER OPERATOR COURT VERIFIER
///   RELAYER1 RELAYER2 RELAYER3
///   REMOTE_EMITTER (bytes32 hex of Solana program pubkey)
///   BRIDGE_ASSET_ID (bytes32)
/// Optional: THRESHOLD (default 2), ROTATION_DELAY (default 1 days),
///   MAX_PER_WINDOW (default 1e24), MAX_PER_TRANSFER (default 1e21),
///   LOCAL_CHAIN_ID (default 11155111), REMOTE_CHAIN_ID (default 100002).
contract DeployTestnet is Script {
    uint64 internal constant SEPOLIA_CHAIN_ID = 11_155_111;
    uint64 internal constant SOLANA_DEVNET_CHAIN_ID = 100_002;

    function run() external {
        address admin = vm.envAddress("ADMIN");
        address guardian = vm.envAddress("GUARDIAN");
        address issuer = vm.envAddress("ISSUER");
        address operator = vm.envAddress("OPERATOR");
        address court = vm.envAddress("COURT");
        address verifier = vm.envAddress("VERIFIER");
        address r1 = vm.envAddress("RELAYER1");
        address r2 = vm.envAddress("RELAYER2");
        address r3 = vm.envAddress("RELAYER3");
        bytes32 remoteEmitter = vm.envBytes32("REMOTE_EMITTER");
        bytes32 bridgeAssetId = vm.envBytes32("BRIDGE_ASSET_ID");

        uint256 threshold = vm.envOr("THRESHOLD", uint256(2));
        uint64 rotationDelay = uint64(vm.envOr("ROTATION_DELAY", uint256(1 days)));
        uint256 maxPerWindow = vm.envOr("MAX_PER_WINDOW", uint256(1e24));
        uint256 maxPerTransfer = vm.envOr("MAX_PER_TRANSFER", uint256(1e21));
        uint64 localChainId = uint64(vm.envOr("LOCAL_CHAIN_ID", uint256(SEPOLIA_CHAIN_ID)));
        uint64 remoteChainId = uint64(vm.envOr("REMOTE_CHAIN_ID", uint256(SOLANA_DEVNET_CHAIN_ID)));

        address[] memory relayers = new address[](3);
        relayers[0] = r1;
        relayers[1] = r2;
        relayers[2] = r3;

        address[] memory certifiers = new address[](2);
        // Lab: issuer + operator act as the two certifiers (threshold 2).
        certifiers[0] = issuer;
        certifiers[1] = operator;

        vm.startBroadcast();

        IdentityRegistry identity = new IdentityRegistry(admin, verifier);
        AttestationRegistry attestation = new AttestationRegistry(admin, certifiers, 2);
        TitleRegistry titles =
            new TitleRegistry(admin, issuer, operator, court, address(identity), address(attestation));
        BridgeEndpoint endpoint = new BridgeEndpoint(
            admin,
            guardian,
            relayers,
            threshold,
            localChainId,
            remoteChainId,
            remoteEmitter,
            bridgeAssetId,
            rotationDelay,
            maxPerWindow,
            maxPerTransfer
        );

        vm.stopBroadcast();

        console2.log("IdentityRegistry", address(identity));
        console2.log("AttestationRegistry", address(attestation));
        console2.log("TitleRegistry", address(titles));
        console2.log("BridgeEndpoint", address(endpoint));
        console2.logBytes32(remoteEmitter);
        console2.logBytes32(bridgeAssetId);
    }
}
