// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title VulnerableBridgeEndpoint
/// @notice INTENTIONALLY VULNERABLE positive-control mirror (REDTEAM only — never deploy).
/// @dev Reproduces Poly (R1), Ronin (R5), Harmony (R6), Nomad (R7), replay (P1), domain skip (P2), no flow (R5c).
contract VulnerableBridgeEndpoint {
    /// @dev Fabricated "admin" msg type — Poly-style open dispatcher (R1).
    uint8 public constant MSG_SET_RELAYERS = 0xff;

    address[] public relayers;
    uint256 public threshold;
    uint64 public epoch;
    bool public paused;

    mapping(bytes32 => bool) public processed;
    /// @notice Cumulative units accepted without a real flow window (R5c measurement).
    uint256 public drained;
    address public titleRegistry;

    event RelayersRotated(address[] newSet, uint256 newThreshold);
    event InboundOk(bytes32 messageId, uint8 msgType);
    event Drained(bytes32 assetId, uint256 amount);

    constructor(address[] memory relayers_, uint256 threshold_) {
        // R6 Harmony bug: no ⌈2n/3⌉ check — accepts 2-of-5.
        require(relayers_.length > 0 && threshold_ > 0 && threshold_ <= relayers_.length, "bad set");
        relayers = relayers_;
        threshold = threshold_;
        epoch = 1;
    }

    /// @notice R2 Qubit: binds a registry without `code.length` check.
    function setTitleRegistry(address titleRegistry_) external {
        titleRegistry = titleRegistry_;
    }

    function pause() external {
        paused = true;
    }

    /// @notice Open inbound path with missing controls (positive control surface).
    /// @param skipEpochCheck R5b: accept stale epoch signatures.
    /// @param skipReplayMark P1: do not mark messageId (or R7: treat unmarked as ok with empty sigs).
    /// @param requireQuorum when false, Nomad-style default-accept (R7).
    function submitInbound(
        bytes32 messageId,
        uint8 msgType,
        bytes32 /*assetId*/,
        uint256 amount,
        uint64 packetEpoch,
        bytes[] calldata signatures,
        bytes32 digest,
        bool skipEpochCheck,
        bool skipReplayMark,
        bool requireQuorum
    ) external returns (bool success) {
        if (paused) return false;

        // R7 Nomad: empty/unknown accepted when requireQuorum=false.
        if (requireQuorum) {
            if (!_quorumOk(digest, signatures)) return false;
        }

        // R5b: real code would demand packetEpoch == epoch.
        if (!skipEpochCheck && packetEpoch != epoch) return false;

        // P1: real code marks before effects; vulnerable can skip.
        if (!skipReplayMark) {
            if (processed[messageId]) return false;
            processed[messageId] = true;
        }

        // R1 Poly: inbound can rotate governance.
        if (msgType == MSG_SET_RELAYERS) {
            // Decode amount as new threshold; signatures' recoveries ignored for set contents —
            // attacker supplies newSet via a side channel in tests by calling rotateDirect.
            return true;
        }

        // R5c: no per-window / per-transfer cap.
        drained += amount;
        emit Drained(bytes32(0), amount);
        emit InboundOk(messageId, msgType);
        return true;
    }

    /// @notice R1 helper: governance change reachable after open dispatcher accepts MSG_SET_RELAYERS.
    function rotateDirect(address[] calldata newSet, uint256 newThreshold) external {
        relayers = newSet;
        threshold = newThreshold; // no D10 check
        unchecked {
            ++epoch;
        }
        emit RelayersRotated(newSet, newThreshold);
    }

    function _quorumOk(bytes32 digest, bytes[] calldata signatures) internal view returns (bool) {
        if (signatures.length < threshold) return false;
        address prev = address(0);
        uint256 valid;
        for (uint256 i; i < signatures.length; ++i) {
            address signer = ECDSA.recover(digest, signatures[i]);
            if (signer == address(0) || !_isRelayer(signer)) return false;
            if (uint160(signer) <= uint160(prev)) return false;
            prev = signer;
            unchecked {
                ++valid;
            }
        }
        return valid >= threshold;
    }

    function _isRelayer(address account) internal view returns (bool) {
        uint256 n = relayers.length;
        for (uint256 i; i < n; ++i) {
            if (relayers[i] == account) return true;
        }
        return false;
    }
}
