//! Token-2022 transfer hook execute — enforces I5 authorized paths.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::errors::MirrorError;
use crate::hook;
use crate::state::{Asset, ASSET_SEED, ESCROW_AUTHORITY_SEED, PERMANENT_DELEGATE_SEED};

#[derive(Accounts)]
pub struct TransferHookExecute<'info> {
    #[account(
        token::mint = mint,
        token::token_program = anchor_spl::token_2022::ID
    )]
    pub source_token: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        token::mint = mint,
        token::token_program = anchor_spl::token_2022::ID
    )]
    pub destination_token: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: transfer authority (owner / delegate). Validated in handler (I5).
    pub owner_delegate: UncheckedAccount<'info>,
    #[account(
        seeds = [ASSET_SEED, asset.asset_id.as_ref()],
        bump = asset.bump,
        constraint = asset.mint == mint.key() @ MirrorError::MintMismatch
    )]
    pub asset: Account<'info, Asset>,
    /// CHECK: permanent delegate PDA
    #[account(
        seeds = [PERMANENT_DELEGATE_SEED, mint.key().as_ref()],
        bump
    )]
    pub permanent_delegate: UncheckedAccount<'info>,
    /// CHECK: escrow authority PDA
    #[account(
        seeds = [ESCROW_AUTHORITY_SEED, mint.key().as_ref()],
        bump
    )]
    pub escrow_authority: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<TransferHookExecute>, _amount: u64) -> Result<()> {
    hook::require_authorized_path(
        ctx.accounts.owner_delegate.key,
        ctx.accounts.permanent_delegate.key,
        ctx.accounts.escrow_authority.key,
    )
}

/// Lightweight instruction used by unit/anchor tests to assert I5 without full Token-2022 CPI.
#[derive(Accounts)]
pub struct AssertTransferPath<'info> {
    /// CHECK: candidate authority
    pub authority: UncheckedAccount<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        seeds = [ASSET_SEED, asset.asset_id.as_ref()],
        bump = asset.bump,
        constraint = asset.mint == mint.key() @ MirrorError::MintMismatch
    )]
    pub asset: Account<'info, Asset>,
    /// CHECK: permanent delegate PDA
    #[account(seeds = [PERMANENT_DELEGATE_SEED, mint.key().as_ref()], bump)]
    pub permanent_delegate: UncheckedAccount<'info>,
    /// CHECK: escrow authority PDA
    #[account(seeds = [ESCROW_AUTHORITY_SEED, mint.key().as_ref()], bump)]
    pub escrow_authority: UncheckedAccount<'info>,
}

pub fn assert_transfer_path(ctx: Context<AssertTransferPath>) -> Result<()> {
    hook::require_authorized_path(
        ctx.accounts.authority.key,
        ctx.accounts.permanent_delegate.key,
        ctx.accounts.escrow_authority.key,
    )
}
