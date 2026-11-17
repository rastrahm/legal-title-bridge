// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IComplianceModule} from "../interfaces/IComplianceModule.sol";
import {RegistryErrors} from "../errors/RegistryErrors.sol";

/// @title MaxHoldersModule
/// @notice Caps the number of holders with non-zero balance per asset.
contract MaxHoldersModule is IComplianceModule {
    uint8 public constant RULE_ID = 2;

    address public immutable TITLE_REGISTRY;
    address public admin;
    mapping(bytes32 assetId => uint256 maxHolders) public maxHolders;
    mapping(bytes32 assetId => uint256 holderCount) public holderCount;
    mapping(bytes32 assetId => mapping(bytes32 holder => bool isHolder)) public isHolder;

    event MaxHoldersSet(bytes32 indexed assetId, uint256 maxHolders);
    event HolderCountUpdated(bytes32 indexed assetId, uint256 holderCount);

    modifier onlyAdmin() {
        _onlyAdmin();
        _;
    }

    modifier onlyRegistry() {
        _onlyRegistry();
        _;
    }

    constructor(address titleRegistry_, address admin_) {
        if (titleRegistry_ == address(0) || admin_ == address(0)) {
            revert RegistryErrors.ZeroAddress();
        }
        TITLE_REGISTRY = titleRegistry_;
        admin = admin_;
    }

    function ruleId() external pure returns (uint8) {
        return RULE_ID;
    }

    function setMaxHolders(bytes32 assetId, uint256 maxHolders_) external onlyAdmin {
        maxHolders[assetId] = maxHolders_;
        emit MaxHoldersSet(assetId, maxHolders_);
    }

    function canTransfer(bytes32 assetId, bytes32, bytes32 to, uint256) external view returns (bool) {
        uint256 maxH = maxHolders[assetId];
        if (maxH == 0) {
            return true; // uncapped
        }
        if (isHolder[assetId][to]) {
            return true;
        }
        return holderCount[assetId] < maxH;
    }

    /// @inheritdoc IComplianceModule
    function onBalancesChanged(bytes32 assetId, bytes32 from, bytes32 to, uint256 fromBalance, uint256 toBalance)
        external
        onlyRegistry
    {
        if (from != bytes32(0)) {
            _sync(assetId, from, fromBalance);
        }
        if (to != bytes32(0) && to != from) {
            _sync(assetId, to, toBalance);
        }
    }

    function _sync(bytes32 assetId, bytes32 holder, uint256 newBalance) internal {
        bool was = isHolder[assetId][holder];
        bool isNow = newBalance > 0;
        if (was == isNow) {
            return;
        }
        if (isNow) {
            isHolder[assetId][holder] = true;
            unchecked {
                ++holderCount[assetId];
            }
        } else {
            isHolder[assetId][holder] = false;
            unchecked {
                --holderCount[assetId];
            }
        }
        emit HolderCountUpdated(assetId, holderCount[assetId]);
    }

    function _onlyAdmin() internal view {
        if (msg.sender != admin) {
            revert RegistryErrors.Unauthorized();
        }
    }

    function _onlyRegistry() internal view {
        if (msg.sender != TITLE_REGISTRY) {
            revert RegistryErrors.Unauthorized();
        }
    }
}
