// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IComplianceModule} from "../interfaces/IComplianceModule.sol";
import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";
import {RegistryErrors} from "../errors/RegistryErrors.sol";

/// @title CountryModule
/// @notice Allows transfers only when the buyer country is in the allowlist.
contract CountryModule is IComplianceModule {
    uint8 public constant RULE_ID = 1;

    IIdentityRegistry public immutable IDENTITY_REGISTRY;
    mapping(uint16 country => bool allowed) public allowedCountry;
    address public admin;

    event CountryAllowed(uint16 country, bool allowed);

    modifier onlyAdmin() {
        _onlyAdmin();
        _;
    }

    constructor(address identityRegistry_, address admin_) {
        if (identityRegistry_ == address(0) || admin_ == address(0)) {
            revert RegistryErrors.ZeroAddress();
        }
        IDENTITY_REGISTRY = IIdentityRegistry(identityRegistry_);
        admin = admin_;
    }

    function ruleId() external pure returns (uint8) {
        return RULE_ID;
    }

    function setCountryAllowed(uint16 country, bool allowed) external onlyAdmin {
        allowedCountry[country] = allowed;
        emit CountryAllowed(country, allowed);
    }

    function canTransfer(bytes32, bytes32, bytes32 to, uint256) external view returns (bool) {
        if (!IDENTITY_REGISTRY.isVerified(to)) {
            return false;
        }
        uint16 country = IDENTITY_REGISTRY.getAssertion(to).country;
        return allowedCountry[country];
    }

    function onBalancesChanged(bytes32, bytes32, bytes32, uint256, uint256) external pure {}

    function _onlyAdmin() internal view {
        if (msg.sender != admin) {
            revert RegistryErrors.Unauthorized();
        }
    }
}
