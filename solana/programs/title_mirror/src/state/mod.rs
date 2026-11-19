use anchor_lang::prelude::*;

pub const MAX_RELAYERS: usize = 16;
pub const CONFIG_SEED: &[u8] = b"config";
pub const ASSET_SEED: &[u8] = b"asset";
pub const PROCESSED_SEED: &[u8] = b"processed";
pub const PERMANENT_DELEGATE_SEED: &[u8] = b"permanent_delegate";
pub const ESCROW_AUTHORITY_SEED: &[u8] = b"escrow_authority";
pub const ESCROW_SEED: &[u8] = b"escrow";
pub const EXTRA_ACCOUNT_METAS_SEED: &[u8] = b"extra-account-metas";

/// D5: unilateral refund only after `deadline + HARD_DEADLINE_SECS`.
pub const HARD_DEADLINE_SECS: i64 = 7 * 24 * 60 * 60;

/// Escrow lifecycle (I4): Pending → Completed | Refunded (terminal, never back).
#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum EscrowStatus {
    Pending = 0,
    Completed = 1,
    Refunded = 2,
}

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
    /// Seconds after `deadline` before unilateral refund (D5). Production: 7 days.
    pub hard_deadline_secs: i64,
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
        + 1                    // paused
        + 8; // hard_deadline_secs
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

/// DvP escrow PDA keyed by `transfer_id` (D3 / D5).
#[account]
pub struct Escrow {
    pub bump: u8,
    pub transfer_id: [u8; 32],
    pub asset: Pubkey,
    pub title_mint: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub payment_mint: Pubkey,
    pub payment_amount: u64,
    pub deadline: i64,
    pub hard_deadline: i64,
    pub status: u8,
    pub travel_rule_hash: [u8; 32],
}

impl Escrow {
    pub const SIZE: usize = 8 // discriminator
        + 1  // bump
        + 32 // transfer_id
        + 32 // asset
        + 32 // title_mint
        + 32 // seller
        + 32 // buyer
        + 8  // amount
        + 32 // payment_mint
        + 8  // payment_amount
        + 8  // deadline
        + 8  // hard_deadline
        + 1  // status
        + 32; // travel_rule_hash

    pub fn status_enum(&self) -> Option<EscrowStatus> {
        match self.status {
            0 => Some(EscrowStatus::Pending),
            1 => Some(EscrowStatus::Completed),
            2 => Some(EscrowStatus::Refunded),
            _ => None,
        }
    }
}
