#![allow(deprecated)]
#![allow(ambiguous_glob_reexports)]
#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

pub mod codec;
pub mod errors;
pub mod hook;
pub mod instructions;
pub mod quorum;
pub mod state;

pub use instructions::*;

declare_id!("H4fc36LTnKLeGfdT5UUCa8d39VM3Q1Z4N8Myf8uc4nRU");

#[program]
pub mod title_mirror {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        params: InitializeConfigParams,
    ) -> Result<()> {
        instructions::initialize_config::handler(ctx, params)
    }

    pub fn rotate_relayers(
        ctx: Context<RotateRelayers>,
        params: RotateRelayersParams,
    ) -> Result<()> {
        instructions::rotate_relayers::handler(ctx, params)
    }

    pub fn initialize_asset(
        ctx: Context<InitializeAsset>,
        asset_id: [u8; 32],
        decimals: u8,
    ) -> Result<()> {
        instructions::initialize_asset::handler(ctx, asset_id, decimals)
    }

    pub fn apply_issue(
        ctx: Context<ApplyIssue>,
        message_id: [u8; 32],
        wire: Vec<u8>,
    ) -> Result<()> {
        instructions::apply_issue::handler(ctx, message_id, wire)
    }

    /// Token-2022 transfer hook entry (I5).
    pub fn transfer_hook(ctx: Context<TransferHookExecute>, amount: u64) -> Result<()> {
        instructions::transfer_hook::handler(ctx, amount)
    }

    /// Test/helper: assert I5 path without invoking the Token-2022 hook CPI machinery.
    pub fn assert_transfer_path(ctx: Context<AssertTransferPath>) -> Result<()> {
        instructions::transfer_hook::assert_transfer_path(ctx)
    }

    pub fn ping(ctx: Context<Ping>) -> Result<()> {
        instructions::ping(ctx)
    }
}
