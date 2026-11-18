// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

import {RegistryErrors} from "./errors/RegistryErrors.sol";
import {AttestationKind, IAttestationRegistry} from "./interfaces/IAttestationRegistry.sol";

/// @title AttestationRegistry
/// @notice EIP-712 asset certifications; issue/decide require quorum on both kinds (I7).
contract AttestationRegistry is IAttestationRegistry, AccessControl, EIP712 {
    bytes32 public constant CERTIFIER_ROLE = keccak256("CERTIFIER_ROLE");

    bytes32 public constant ATTESTATION_TYPEHASH = keccak256("Attestation(bytes32 assetId,uint8 kind,uint64 expiry)");

    /// @notice Minimum distinct certifiers with a live attestation per critical kind.
    uint256 public threshold;

    address[] private _certifiers;

    /// @dev assetId => kind => certifier => expiry
    mapping(bytes32 assetId => mapping(uint8 kind => mapping(address certifier => uint64 expiry))) private _expiry;

    event Attested(bytes32 indexed assetId, uint8 kind, uint64 expiry, address indexed certifier);
    event ThresholdUpdated(uint256 threshold);
    event CertifierAdded(address indexed certifier);

    /// @param admin DEFAULT_ADMIN_ROLE (must differ from every certifier — D13).
    /// @param certifiers_ Initial CERTIFIER_ROLE set (unique, non-zero, ≠ admin).
    /// @param threshold_ Quorum size; 1..certifiers_.length.
    constructor(address admin, address[] memory certifiers_, uint256 threshold_) EIP712("LegalTitleBridge", "1") {
        if (admin == address(0)) {
            revert RegistryErrors.ZeroAddress();
        }
        if (certifiers_.length == 0 || threshold_ == 0 || threshold_ > certifiers_.length) {
            revert RegistryErrors.ThresholdInvalid();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        threshold = threshold_;

        uint256 n = certifiers_.length;
        for (uint256 i; i < n; ++i) {
            address c = certifiers_[i];
            if (c == address(0)) {
                revert RegistryErrors.ZeroAddress();
            }
            if (c == admin) {
                revert RegistryErrors.RoleOverlap(DEFAULT_ADMIN_ROLE, CERTIFIER_ROLE);
            }
            if (hasRole(CERTIFIER_ROLE, c)) {
                revert RegistryErrors.DuplicateCertifier(c);
            }
            _grantRole(CERTIFIER_ROLE, c);
            _certifiers.push(c);
            emit CertifierAdded(c);
        }
        emit ThresholdUpdated(threshold_);
    }

    /// @inheritdoc IAttestationRegistry
    function attest(bytes32 assetId, uint8 kind, uint64 expiry, bytes calldata signature) external {
        if (assetId == bytes32(0)) {
            revert RegistryErrors.ZeroAddress();
        }
        if (kind != AttestationKind.EXISTENCE && kind != AttestationKind.REGISTRAL) {
            revert RegistryErrors.InvalidKind(kind);
        }
        if (expiry <= block.timestamp) {
            revert RegistryErrors.AttestationExpired(assetId);
        }

        bytes32 digest = _hashAttestation(assetId, kind, expiry);
        address signer = ECDSA.recover(digest, signature);
        if (signer == address(0) || !hasRole(CERTIFIER_ROLE, signer)) {
            revert RegistryErrors.InvalidSignature();
        }

        _expiry[assetId][kind][signer] = expiry;
        emit Attested(assetId, kind, expiry, signer);
    }

    /// @inheritdoc IAttestationRegistry
    function isCertified(bytes32 assetId) public view returns (bool) {
        return quorumMet(assetId);
    }

    /// @inheritdoc IAttestationRegistry
    function quorumMet(bytes32 assetId) public view returns (bool) {
        return _kindQuorumMet(assetId, AttestationKind.EXISTENCE) && _kindQuorumMet(assetId, AttestationKind.REGISTRAL);
    }

    /// @inheritdoc IAttestationRegistry
    function expiryOf(bytes32 assetId, uint8 kind, address certifier) external view returns (uint64) {
        return _expiry[assetId][kind][certifier];
    }

    /// @notice Number of distinct live attestations for a kind (addresses, not raw signatures — X12).
    function liveCount(bytes32 assetId, uint8 kind) public view returns (uint256 count) {
        uint256 n = _certifiers.length;
        for (uint256 i; i < n; ++i) {
            if (_expiry[assetId][kind][_certifiers[i]] > block.timestamp) {
                unchecked {
                    ++count;
                }
            }
        }
    }

    function certifierCount() external view returns (uint256) {
        return _certifiers.length;
    }

    function certifierAt(uint256 index) external view returns (address) {
        return _certifiers[index];
    }

    /// @notice EIP-712 digest helper for tests / offline signing.
    function hashAttestation(bytes32 assetId, uint8 kind, uint64 expiry) external view returns (bytes32) {
        return _hashAttestation(assetId, kind, expiry);
    }

    /// @notice Admin may raise/lower threshold within [1, certifierCount].
    function setThreshold(uint256 threshold_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (threshold_ == 0 || threshold_ > _certifiers.length) {
            revert RegistryErrors.ThresholdInvalid();
        }
        threshold = threshold_;
        emit ThresholdUpdated(threshold_);
    }

    /// @notice Add a certifier (D13: cannot equal admin; no duplicates).
    function addCertifier(address certifier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (certifier == address(0)) {
            revert RegistryErrors.ZeroAddress();
        }
        if (certifier == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, certifier)) {
            revert RegistryErrors.RoleOverlap(DEFAULT_ADMIN_ROLE, CERTIFIER_ROLE);
        }
        if (hasRole(CERTIFIER_ROLE, certifier)) {
            revert RegistryErrors.DuplicateCertifier(certifier);
        }
        _grantRole(CERTIFIER_ROLE, certifier);
        _certifiers.push(certifier);
        emit CertifierAdded(certifier);
    }

    function _kindQuorumMet(bytes32 assetId, uint8 kind) internal view returns (bool) {
        return liveCount(assetId, kind) >= threshold;
    }

    function _hashAttestation(bytes32 assetId, uint8 kind, uint64 expiry) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(ATTESTATION_TYPEHASH, assetId, kind, expiry)));
    }
}
