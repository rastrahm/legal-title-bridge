use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::Mint;

use crate::errors::MirrorError;
use crate::state::{
    Asset, Config, ASSET_SEED, CONFIG_SEED, ESCROW_AUTHORITY_SEED, PERMANENT_DELEGATE_SEED,
};

#[derive(Accounts)]
#[instruction(asset_id: [u8; 32], decimals: u8)]
pub struct InitializeAsset<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ MirrorError::Unauthorized
    )]
    pub config: Account<'info, Config>,
    /// CHECK: PDA permanent delegate / mint authority for this asset (forced mover + ISSUE mint).
    #[account(
        seeds = [PERMANENT_DELEGATE_SEED, mint.key().as_ref()],
        bump
    )]
    pub permanent_delegate: UncheckedAccount<'info>,
    /// CHECK: PDA escrow authority consulted by the transfer hook (I5). Escrow lives in DVP.
    #[account(
        seeds = [ESCROW_AUTHORITY_SEED, mint.key().as_ref()],
        bump
    )]
    pub escrow_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = admin,
        mint::decimals = decimals,
        mint::authority = permanent_delegate,
        mint::token_program = token_program,
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = admin,
        space = Asset::SIZE,
        seeds = [ASSET_SEED, asset_id.as_ref()],
        bump
    )]
    pub asset: Account<'info, Asset>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<InitializeAsset>, asset_id: [u8; 32], decimals: u8) -> Result<()> {
    require!(asset_id != [0u8; 32], MirrorError::ZeroAddress);
    let _ = decimals;

    let asset = &mut ctx.accounts.asset;
    asset.bump = ctx.bumps.asset;
    asset.config = ctx.accounts.config.key();
    asset.asset_id = asset_id;
    asset.mint = ctx.accounts.mint.key();
    asset.permanent_delegate = ctx.accounts.permanent_delegate.key();
    asset.decimals = ctx.accounts.mint.decimals;
    asset.issued = 0;
    Ok(())
}
