//! Unilateral refund after hardDeadline (D5). Pays original owners only (P9).

use anchor_lang::prelude::*;
use anchor_spl::token_2022::{transfer_checked, Token2022, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::dvp;
use crate::errors::MirrorError;
use crate::state::{Escrow, EscrowStatus, ESCROW_AUTHORITY_SEED, ESCROW_SEED};

#[derive(Accounts)]
pub struct RefundAfterHardDeadline<'info> {
    /// Permissionless caller — must NOT receive funds (P9).
    pub caller: Signer<'info>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, escrow.transfer_id.as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(
        constraint = title_mint.key() == escrow.title_mint @ MirrorError::MintMismatch,
        mint::token_program = title_token_program
    )]
    pub title_mint: InterfaceAccount<'info, Mint>,
    /// CHECK: escrow authority PDA
    #[account(seeds = [ESCROW_AUTHORITY_SEED, title_mint.key().as_ref()], bump)]
    pub escrow_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = title_mint,
        token::authority = escrow_authority,
        token::token_program = title_token_program
    )]
    pub escrow_title_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = seller_title_ata.owner == escrow.seller @ MirrorError::Unauthorized,
        token::mint = title_mint,
        token::token_program = title_token_program
    )]
    pub seller_title_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        constraint = payment_mint.key() == escrow.payment_mint @ MirrorError::MintMismatch,
        mint::token_program = payment_token_program
    )]
    pub payment_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = payment_mint,
        token::authority = escrow,
        token::token_program = payment_token_program
    )]
    pub escrow_payment_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = buyer_payment_ata.owner == escrow.buyer @ MirrorError::Unauthorized,
        token::mint = payment_mint,
        token::token_program = payment_token_program
    )]
    pub buyer_payment_ata: InterfaceAccount<'info, TokenAccount>,
    pub title_token_program: Program<'info, Token2022>,
    pub payment_token_program: Program<'info, Token2022>,
}

pub fn handler(ctx: Context<RefundAfterHardDeadline>) -> Result<()> {
    let escrow = &ctx.accounts.escrow;
    let status = escrow
        .status_enum()
        .ok_or(error!(MirrorError::EscrowNotPending))?;
    let now = Clock::get()?.unix_timestamp;
    dvp::require_unilateral_refund(now, escrow.hard_deadline, status)?;

    let transfer_id = escrow.transfer_id;
    let title_amount = escrow.amount;
    let payment_amount = escrow.payment_amount;
    let title_decimals = ctx.accounts.title_mint.decimals;
    let payment_decimals = ctx.accounts.payment_mint.decimals;

    let title_mint_key = ctx.accounts.title_mint.key();
    let auth_bump = ctx.bumps.escrow_authority;
    let auth_seeds: &[&[u8]] = &[ESCROW_AUTHORITY_SEED, title_mint_key.as_ref(), &[auth_bump]];
    let auth_signer = &[auth_seeds];

    let escrow_bump = escrow.bump;
    let escrow_seeds: &[&[u8]] = &[ESCROW_SEED, transfer_id.as_ref(), &[escrow_bump]];
    let escrow_signer = &[escrow_seeds];

    // Title → seller (original owner).
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.title_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.escrow_title_ata.to_account_info(),
                mint: ctx.accounts.title_mint.to_account_info(),
                to: ctx.accounts.seller_title_ata.to_account_info(),
                authority: ctx.accounts.escrow_authority.to_account_info(),
            },
            auth_signer,
        ),
        title_amount,
        title_decimals,
    )?;

    // Payment → buyer (original owner). Caller never receives funds (P9).
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.payment_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.escrow_payment_ata.to_account_info(),
                mint: ctx.accounts.payment_mint.to_account_info(),
                to: ctx.accounts.buyer_payment_ata.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            },
            escrow_signer,
        ),
        payment_amount,
        payment_decimals,
    )?;

    ctx.accounts.escrow.status = EscrowStatus::Refunded as u8;
    Ok(())
}
