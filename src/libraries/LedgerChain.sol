// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @title LedgerChain
/// @notice Hash-chained ledger entries: entryHash = keccak256(prevHash, dataHash).
library LedgerChain {
    /// @notice Computes the next entry hash in the chain.
    /// @param prevHash Previous entry hash (bytes32(0) for genesis).
    /// @param dataHash Keccak256 of the entry payload.
    /// @return nextHash Chained hash.
    function nextHash(bytes32 prevHash, bytes32 dataHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(prevHash, dataHash));
    }

    /// @notice Verifies a contiguous chain of entry hashes against data hashes.
    /// @param entryHashes Ordered entry hashes (index 0 = first entry).
    /// @param dataHashes Ordered data hashes used when appending.
    /// @return ok True if every link matches.
    function verifyChain(bytes32[] memory entryHashes, bytes32[] memory dataHashes) internal pure returns (bool ok) {
        if (entryHashes.length != dataHashes.length) {
            return false;
        }
        bytes32 prev = bytes32(0);
        for (uint256 i; i < entryHashes.length; ++i) {
            if (nextHash(prev, dataHashes[i]) != entryHashes[i]) {
                return false;
            }
            prev = entryHashes[i];
        }
        return true;
    }
}
