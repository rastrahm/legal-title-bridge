//! Admin bootstrap mint (local / tests) via permanent-delegate mint authority.
//! Production ISSUE path remains `apply_issue` with relayer quorum.

use anchor_lang::prelude::*;
use anchor_spl::token_2022::{mint_to, MintTo, Token2022};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::errors::MirrorError;
use crate::state::{Asset, Config, ASSET_SEED, CONFIG_SEED, PERMANENT_DELEGATE_SEED};

#[derive(Accounts)]
pub struct MintToHolder<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ MirrorError::Unauthorized,
        constraint = !config.paused @ MirrorError::Paused
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [ASSET_SEED, asset.asset_id.as_ref()],
        bump = asset.bump,
        constraint = asset.config == config.key() @ MirrorError::ConfigMismatch
    )]
    pub asset: Account<'info, Asset>,
    #[account(
        mut,
        constraint = mint.key() == asset.mint @ MirrorError::MintMismatch,
        mint::token_program = token_program
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    /// CHECK: mint authority PDA
    #[account(seeds = [PERMANENT_DELEGATE_SEED, mint.key().as_ref()], bump)]
    pub permanent_delegate: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program
    )]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<MintToHolder>, amount: u64) -> Result<()> {
    require!(amount > 0, MirrorError::InvalidPacket);

    let mint_key = ctx.accounts.mint.key();
    let bump = ctx.bumps.permanent_delegate;
    let seeds: &[&[u8]] = &[PERMANENT_DELEGATE_SEED, mint_key.as_ref(), &[bump]];
    let signer = &[seeds];

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.permanent_delegate.to_account_info(),
            },
            signer,
        ),
        amount,
    )?;

    ctx.accounts.asset.issued = ctx
        .accounts
        .asset
        .issued
        .checked_add(amount)
        .ok_or(MirrorError::MathOverflow)?;
    Ok(())
}
