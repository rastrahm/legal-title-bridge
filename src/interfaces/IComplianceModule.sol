// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @title IComplianceModule
/// @notice Transfer rule module consulted by TitleRegistry before approving a transfer.
interface IComplianceModule {
    /// @notice Unique rule id used in TransferNotCompliant.
    function ruleId() external view returns (uint8);

    /// @notice Whether a transfer is allowed under this rule.
    /// @param assetId Asset identifier.
    /// @param from Seller Solana pubkey.
    /// @param to Buyer Solana pubkey.
    /// @param amount Units to transfer.
    function canTransfer(bytes32 assetId, bytes32 from, bytes32 to, uint256 amount) external view returns (bool);

    /// @notice Hook after TitleRegistry updates balances (no-op for stateless rules).
    /// @param assetId Asset identifier.
    /// @param from Holder that lost units (bytes32(0) on mint/issue).
    /// @param to Holder that gained units (bytes32(0) on redeem).
    /// @param fromBalance New balance of `from`.
    /// @param toBalance New balance of `to`.
    function onBalancesChanged(bytes32 assetId, bytes32 from, bytes32 to, uint256 fromBalance, uint256 toBalance)
        external;
}
