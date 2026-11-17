// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IComplianceModule} from "../interfaces/IComplianceModule.sol";
import {RegistryErrors} from "../errors/RegistryErrors.sol";

/// @title LockupModule
/// @notice Blocks transfers from a holder until `lockupUntil` timestamp.
contract LockupModule is IComplianceModule {
    uint8 public constant RULE_ID = 3;

    address public admin;
    mapping(bytes32 assetId => mapping(bytes32 holder => uint64 lockupUntil)) public lockupUntil;

    event LockupSet(bytes32 indexed assetId, bytes32 indexed holder, uint64 lockupUntil);

    modifier onlyAdmin() {
        _onlyAdmin();
        _;
    }

    constructor(address admin_) {
        if (admin_ == address(0)) {
            revert RegistryErrors.ZeroAddress();
        }
        admin = admin_;
    }

    function ruleId() external pure returns (uint8) {
        return RULE_ID;
    }

    function setLockup(bytes32 assetId, bytes32 holder, uint64 until) external onlyAdmin {
        lockupUntil[assetId][holder] = until;
        emit LockupSet(assetId, holder, until);
    }

    function canTransfer(bytes32 assetId, bytes32 from, bytes32, uint256) external view returns (bool) {
        return lockupUntil[assetId][from] <= block.timestamp;
    }

    function onBalancesChanged(bytes32, bytes32, bytes32, uint256, uint256) external pure {}

    function _onlyAdmin() internal view {
        if (msg.sender != admin) {
            revert RegistryErrors.Unauthorized();
        }
    }
}
