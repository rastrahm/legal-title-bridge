// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

import {RegistryErrors} from "./errors/RegistryErrors.sol";
import {Assertion, IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

/// @title IdentityRegistry
/// @notice Stores verifier EIP-712 assertions keyed by Solana pubkey (`bytes32`).
contract IdentityRegistry is IIdentityRegistry, AccessControl, EIP712 {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    bytes32 public constant ASSERTION_TYPEHASH =
        keccak256("Assertion(bytes32 holder,uint16 country,uint8 investorType,uint64 expiry)");

    mapping(bytes32 holder => Assertion assertion) private _assertions;
    mapping(bytes32 holder => bool revoked) private _revoked;

    event AssertionRegistered(
        bytes32 indexed holder, uint16 country, uint8 investorType, uint64 expiry, address indexed verifier
    );
    event AssertionRevoked(bytes32 indexed holder, address indexed verifier);

    /// @param admin Admin / default admin for role grants.
    /// @param verifier Address with VERIFIER_ROLE (must differ from admin for D13 checks at deploy).
    constructor(address admin, address verifier) EIP712("LegalTitleBridge", "1") {
        if (admin == address(0) || verifier == address(0)) {
            revert RegistryErrors.ZeroAddress();
        }
        if (admin == verifier) {
            revert RegistryErrors.RoleOverlap(DEFAULT_ADMIN_ROLE, VERIFIER_ROLE);
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, verifier);
    }

    /// @inheritdoc IIdentityRegistry
    function registerAssertion(Assertion calldata assertion, bytes calldata signature) external {
        if (assertion.holder == bytes32(0)) {
            revert RegistryErrors.ZeroAddress();
        }
        if (assertion.expiry <= block.timestamp) {
            revert RegistryErrors.AssertionExpired(assertion.holder);
        }

        bytes32 digest = _hashAssertion(assertion);
        address signer = ECDSA.recover(digest, signature);
        if (signer == address(0) || !hasRole(VERIFIER_ROLE, signer)) {
            revert RegistryErrors.InvalidSignature();
        }

        _assertions[assertion.holder] = assertion;
        _revoked[assertion.holder] = false;
        emit AssertionRegistered(assertion.holder, assertion.country, assertion.investorType, assertion.expiry, signer);
    }

    /// @inheritdoc IIdentityRegistry
    function revoke(bytes32 holder) external onlyRole(VERIFIER_ROLE) {
        if (_assertions[holder].holder == bytes32(0)) {
            revert RegistryErrors.AssertionMissing(holder);
        }
        _revoked[holder] = true;
        emit AssertionRevoked(holder, msg.sender);
    }

    /// @inheritdoc IIdentityRegistry
    function isVerified(bytes32 holder) public view returns (bool) {
        Assertion memory a = _assertions[holder];
        if (a.holder == bytes32(0) || _revoked[holder]) {
            return false;
        }
        return a.expiry > block.timestamp;
    }

    /// @inheritdoc IIdentityRegistry
    function getAssertion(bytes32 holder) external view returns (Assertion memory) {
        return _assertions[holder];
    }

    /// @notice EIP-712 digest for an assertion (for tests / offline signing).
    function hashAssertion(Assertion calldata assertion) external view returns (bytes32) {
        return _hashAssertion(assertion);
    }

    function _hashAssertion(Assertion calldata assertion) internal view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ASSERTION_TYPEHASH, assertion.holder, assertion.country, assertion.investorType, assertion.expiry
                )
            )
        );
    }
}
