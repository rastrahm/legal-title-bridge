use anchor_lang::prelude::*;
use anchor_spl::token_2022::{mint_to, MintTo, Token2022};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::codec::MsgType;
use crate::errors::MirrorError;
use crate::inbound;
use crate::state::{
    Asset, Config, ProcessedMessage, ASSET_SEED, CONFIG_SEED, PERMANENT_DELEGATE_SEED,
    PROCESSED_SEED,
};

#[derive(Accounts)]
#[instruction(message_id: [u8; 32])]
pub struct ApplyIssue<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
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
    #[account(
        seeds = [PERMANENT_DELEGATE_SEED, mint.key().as_ref()],
        bump
    )]
    pub permanent_delegate: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program
    )]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init,
        payer = payer,
        space = ProcessedMessage::SIZE,
        seeds = [PROCESSED_SEED, message_id.as_ref()],
        bump
    )]
    pub processed: Account<'info, ProcessedMessage>,
    /// CHECK: must be Instructions sysvar (R3). Constraint + quorum re-check.
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID @ MirrorError::InvalidInstructionsSysvar)]
    pub instructions_sysvar: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ApplyIssue>, message_id: [u8; 32], wire: Vec<u8>) -> Result<()> {
    let packet =
        inbound::decode_typed_inbound(&wire, &message_id, &ctx.accounts.config, MsgType::Issue)?;
    let parsed = inbound::parse_issue_payload(&packet.payload)?;
    require!(
        parsed.asset_id == ctx.accounts.asset.asset_id,
        MirrorError::MintMismatch
    );

    inbound::verify_quorum(
        &ctx.accounts.instructions_sysvar.to_account_info(),
        &packet,
        &ctx.accounts.config,
    )?;

    ctx.accounts.processed.bump = ctx.bumps.processed;
    ctx.accounts.processed.message_id = message_id;

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
        parsed.amount,
    )?;

    ctx.accounts.asset.issued = ctx
        .accounts
        .asset
        .issued
        .checked_add(parsed.amount)
        .ok_or(MirrorError::InvalidPacket)?;
    Ok(())
}
