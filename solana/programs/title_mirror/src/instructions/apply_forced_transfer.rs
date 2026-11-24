//! Apply FORCED_TRANSFER from Ethereum: court move or in-kind burn (`to == 0`).

use anchor_lang::prelude::*;
use anchor_spl::token_2022::{
    burn_checked, transfer_checked, BurnChecked, Token2022, TransferChecked,
};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::codec::MsgType;
use crate::errors::MirrorError;
use crate::inbound::{self, ForcedPayload};
use crate::state::{
    Asset, Config, ProcessedMessage, ASSET_SEED, CONFIG_SEED, PERMANENT_DELEGATE_SEED,
    PROCESSED_SEED,
};

#[derive(Accounts)]
#[instruction(message_id: [u8; 32])]
pub struct ApplyForcedTransfer<'info> {
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
        seeds = [ASSET_SEED, asset.asset_id.as_ref()],
        bump = asset.bump,
        constraint = asset.config == config.key() @ MirrorError::ConfigMismatch
    )]
    pub asset: Box<Account<'info, Asset>>,
    #[account(
        mut,
        constraint = mint.key() == asset.mint @ MirrorError::MintMismatch,
        mint::token_program = token_program
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    /// CHECK: permanent delegate PDA (I5 court path).
    #[account(seeds = [PERMANENT_DELEGATE_SEED, mint.key().as_ref()], bump)]
    pub permanent_delegate: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program
    )]
    pub source_title_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    /// Destination ATA when moving; pass source again when burning (`to == 0`).
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program
    )]
    pub destination_title_ata: Box<InterfaceAccount<'info, TokenAccount>>,
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
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ApplyForcedTransfer>,
    message_id: [u8; 32],
    wire: Vec<u8>,
) -> Result<()> {
    let parsed = parse_and_verify_forced(
        &ctx.accounts.config,
        &ctx.accounts.asset.asset_id,
        &ctx.accounts.instructions_sysvar.to_account_info(),
        &message_id,
        &wire,
    )?;
    ctx.accounts.processed.bump = ctx.bumps.processed;
    ctx.accounts.processed.message_id = message_id;

    let mint_key = ctx.accounts.mint.key();
    let decimals = ctx.accounts.mint.decimals;
    let pd_bump = ctx.bumps.permanent_delegate;
    let pd_seeds: &[&[u8]] = &[PERMANENT_DELEGATE_SEED, mint_key.as_ref(), &[pd_bump]];

    require_keys_eq!(
        ctx.accounts.source_title_ata.owner,
        Pubkey::new_from_array(parsed.from),
        MirrorError::Unauthorized
    );

    if parsed.to == [0u8; 32] {
        burn_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                BurnChecked {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.source_title_ata.to_account_info(),
                    authority: ctx.accounts.permanent_delegate.to_account_info(),
                },
                &[pd_seeds],
            ),
            parsed.amount,
            decimals,
        )?;
        ctx.accounts.asset.issued = ctx
            .accounts
            .asset
            .issued
            .checked_sub(parsed.amount)
            .ok_or(MirrorError::MathOverflow)?;
    } else {
        require_keys_eq!(
            ctx.accounts.destination_title_ata.owner,
            Pubkey::new_from_array(parsed.to),
            MirrorError::Unauthorized
        );

        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.source_title_ata.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination_title_ata.to_account_info(),
                    authority: ctx.accounts.permanent_delegate.to_account_info(),
                },
                &[pd_seeds],
            ),
            parsed.amount,
            decimals,
        )?;
    }
    Ok(())
}

/// Shared FORCED_TRANSFER verify used by court move and P7 paths.
pub(crate) fn parse_and_verify_forced<'info>(
    config: &Config,
    asset_id: &[u8; 32],
    instructions_sysvar: &AccountInfo<'info>,
    message_id: &[u8; 32],
    wire: &[u8],
) -> Result<ForcedPayload> {
    let packet = inbound::decode_typed_inbound(wire, message_id, config, MsgType::ForcedTransfer)?;
    let parsed = inbound::parse_forced_payload(&packet.payload)?;
    require!(parsed.asset_id == *asset_id, MirrorError::MintMismatch);
    require!(parsed.from != [0u8; 32], MirrorError::ZeroAddress);
    inbound::verify_quorum(instructions_sysvar, &packet, config)?;
    Ok(parsed)
}
