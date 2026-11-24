//! Apply TRANSFER_DECISION from Ethereum (D4→D5/D6).

use anchor_lang::prelude::*;
use anchor_spl::token_2022::{transfer_checked, Token2022, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::codec::MsgType;
use crate::dvp;
use crate::errors::MirrorError;
use crate::inbound;
use crate::state::{
    Config, Escrow, EscrowStatus, ProcessedMessage, CONFIG_SEED, ESCROW_AUTHORITY_SEED,
    ESCROW_SEED, PROCESSED_SEED,
};

/// Outcome bytes matching PROTOCOLO / DecisionOutcome.
pub const OUTCOME_APPROVED: u8 = 0;
pub const OUTCOME_REJECTED: u8 = 1;
pub const OUTCOME_EXPIRED: u8 = 2;

#[derive(Accounts)]
#[instruction(message_id: [u8; 32])]
pub struct ApplyDecision<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = !config.paused @ MirrorError::Paused
    )]
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, escrow.transfer_id.as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Box<Account<'info, Escrow>>,
    #[account(
        constraint = title_mint.key() == escrow.title_mint @ MirrorError::MintMismatch,
        mint::token_program = title_token_program
    )]
    pub title_mint: Box<InterfaceAccount<'info, Mint>>,
    /// CHECK: escrow authority for title vault moves (I5).
    #[account(seeds = [ESCROW_AUTHORITY_SEED, title_mint.key().as_ref()], bump)]
    pub escrow_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = title_mint,
        token::authority = escrow_authority,
        token::token_program = title_token_program
    )]
    pub escrow_title_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = seller_title_ata.owner == escrow.seller @ MirrorError::Unauthorized,
        token::mint = title_mint,
        token::token_program = title_token_program
    )]
    pub seller_title_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = buyer_title_ata.owner == escrow.buyer @ MirrorError::Unauthorized,
        token::mint = title_mint,
        token::token_program = title_token_program
    )]
    pub buyer_title_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        constraint = payment_mint.key() == escrow.payment_mint @ MirrorError::MintMismatch,
        mint::token_program = payment_token_program
    )]
    pub payment_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        token::mint = payment_mint,
        token::authority = escrow,
        token::token_program = payment_token_program
    )]
    pub escrow_payment_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = seller_payment_ata.owner == escrow.seller @ MirrorError::Unauthorized,
        token::mint = payment_mint,
        token::token_program = payment_token_program
    )]
    pub seller_payment_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = buyer_payment_ata.owner == escrow.buyer @ MirrorError::Unauthorized,
        token::mint = payment_mint,
        token::token_program = payment_token_program
    )]
    pub buyer_payment_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init,
        payer = payer,
        space = ProcessedMessage::SIZE,
        seeds = [PROCESSED_SEED, message_id.as_ref()],
        bump
    )]
    pub processed: Box<Account<'info, ProcessedMessage>>,
    /// CHECK: Instructions sysvar (R3).
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID @ MirrorError::InvalidInstructionsSysvar)]
    pub instructions_sysvar: UncheckedAccount<'info>,
    pub title_token_program: Program<'info, Token2022>,
    pub payment_token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ApplyDecision>, message_id: [u8; 32], wire: Vec<u8>) -> Result<()> {
    require!(
        ctx.accounts.escrow.status_enum() == Some(EscrowStatus::Pending),
        MirrorError::EscrowNotPending
    );

    let packet = inbound::decode_typed_inbound(
        &wire,
        &message_id,
        &ctx.accounts.config,
        MsgType::TransferDecision,
    )?;
    let parsed = inbound::parse_decision_payload(&packet.payload)?;
    require!(
        parsed.transfer_id == ctx.accounts.escrow.transfer_id,
        MirrorError::InvalidPacket
    );
    require!(
        parsed.amount == ctx.accounts.escrow.amount,
        MirrorError::AmountMismatch
    );
    require!(
        parsed.outcome == OUTCOME_APPROVED
            || parsed.outcome == OUTCOME_REJECTED
            || parsed.outcome == OUTCOME_EXPIRED,
        MirrorError::InvalidPacket
    );

    inbound::verify_quorum(
        &ctx.accounts.instructions_sysvar.to_account_info(),
        &packet,
        &ctx.accounts.config,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let hard_deadline = ctx.accounts.escrow.hard_deadline;
    if parsed.outcome == OUTCOME_APPROVED {
        dvp::require_approved_before_hard_deadline(now, hard_deadline)?;
    }

    ctx.accounts.processed.bump = ctx.bumps.processed;
    ctx.accounts.processed.message_id = message_id;

    let title_mint_key = ctx.accounts.title_mint.key();
    let auth_bump = ctx.bumps.escrow_authority;
    let escrow_bump = ctx.accounts.escrow.bump;
    let title_amount = ctx.accounts.escrow.amount;
    let payment_amount = ctx.accounts.escrow.payment_amount;
    let title_decimals = ctx.accounts.title_mint.decimals;
    let payment_decimals = ctx.accounts.payment_mint.decimals;
    let transfer_id = parsed.transfer_id;

    let auth_seeds: &[&[u8]] = &[ESCROW_AUTHORITY_SEED, title_mint_key.as_ref(), &[auth_bump]];
    let escrow_seeds: &[&[u8]] = &[ESCROW_SEED, transfer_id.as_ref(), &[escrow_bump]];

    if parsed.outcome == OUTCOME_APPROVED {
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.title_token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.escrow_title_ata.to_account_info(),
                    mint: ctx.accounts.title_mint.to_account_info(),
                    to: ctx.accounts.buyer_title_ata.to_account_info(),
                    authority: ctx.accounts.escrow_authority.to_account_info(),
                },
                &[auth_seeds],
            ),
            title_amount,
            title_decimals,
        )?;
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.payment_token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.escrow_payment_ata.to_account_info(),
                    mint: ctx.accounts.payment_mint.to_account_info(),
                    to: ctx.accounts.seller_payment_ata.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                &[escrow_seeds],
            ),
            payment_amount,
            payment_decimals,
        )?;
        ctx.accounts.escrow.status = EscrowStatus::Completed as u8;
    } else {
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.title_token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.escrow_title_ata.to_account_info(),
                    mint: ctx.accounts.title_mint.to_account_info(),
                    to: ctx.accounts.seller_title_ata.to_account_info(),
                    authority: ctx.accounts.escrow_authority.to_account_info(),
                },
                &[auth_seeds],
            ),
            title_amount,
            title_decimals,
        )?;
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.payment_token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.escrow_payment_ata.to_account_info(),
                    mint: ctx.accounts.payment_mint.to_account_info(),
                    to: ctx.accounts.buyer_payment_ata.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                &[escrow_seeds],
            ),
            payment_amount,
            payment_decimals,
        )?;
        ctx.accounts.escrow.status = EscrowStatus::Refunded as u8;
    }

    Ok(())
}
