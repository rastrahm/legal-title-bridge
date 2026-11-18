use anchor_lang::prelude::*;

pub const MAX_RELAYERS: usize = 16;
pub const CONFIG_SEED: &[u8] = b"config";
pub const ASSET_SEED: &[u8] = b"asset";
pub const PROCESSED_SEED: &[u8] = b"processed";
pub const PERMANENT_DELEGATE_SEED: &[u8] = b"permanent_delegate";
pub const ESCROW_AUTHORITY_SEED: &[u8] = b"escrow_authority";
pub const EXTRA_ACCOUNT_METAS_SEED: &[u8] = b"extra-account-metas";

/// Bridge config: Ethereum endpoint identity + relayer quorum (D10/D11).
#[account]
pub struct Config {
    pub bump: u8,
    pub admin: Pubkey,
    /// Ethereum BridgeEndpoint address left-padded / keccak identity as bytes32.
    pub eth_endpoint: [u8; 32],
    pub local_chain_id: u64,
    pub remote_chain_id: u64,
    pub epoch: u64,
    pub threshold: u8,
    pub relayer_count: u8,
    pub relayers: [[u8; 20]; MAX_RELAYERS],
    pub paused: bool,
}

impl Config {
    pub const SIZE: usize = 8  // discriminator
        + 1                    // bump
        + 32                   // admin
        + 32                   // eth_endpoint
        + 8                    // local_chain_id
        + 8                    // remote_chain_id
        + 8                    // epoch
        + 1                    // threshold
        + 1                    // relayer_count
        + (20 * MAX_RELAYERS)  // relayers
        + 1; // paused
}

/// Per-asset mint mirror metadata.
#[account]
pub struct Asset {
    pub bump: u8,
    pub config: Pubkey,
    pub asset_id: [u8; 32],
    pub mint: Pubkey,
    pub permanent_delegate: Pubkey,
    pub decimals: u8,
    pub issued: u64,
}

impl Asset {
    pub const SIZE: usize = 8 + 1 + 32 + 32 + 32 + 32 + 1 + 8;
}

/// Idempotency marker for inbound message ids (I3).
#[account]
pub struct ProcessedMessage {
    pub bump: u8,
    pub message_id: [u8; 32],
}

impl ProcessedMessage {
    pub const SIZE: usize = 8 + 1 + 32;
}
