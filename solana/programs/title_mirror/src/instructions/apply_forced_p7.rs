//! P7: court order against tokens locked in a Pending escrow.
//! Refunds payment to buyer; moves title from escrow vault to court recipient.

use anchor_lang::prelude::*;
use anchor_spl::token_2022::{transfer_checked, Token2022, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::codec::{self, MsgType};
use crate::errors::MirrorError;
use crate::quorum;
use crate::state::{
    Asset, Config, Escrow, EscrowStatus, ProcessedMessage, ASSET_SEED, CONFIG_SEED,
    ESCROW_AUTHORITY_SEED, ESCROW_SEED, PROCESSED_SEED,
};

#[derive(Accounts)]
#[instruction(message_id: [u8; 32])]
pub struct ApplyForcedP7<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = !config.paused @ MirrorError::Paused
    )]
    pub config: Box<Account<'info, Config>>,
    #[account(
        seeds = [ASSET_SEED, asset.asset_id.as_ref()],
        bump = asset.bump,
        constraint = asset.config == config.key() @ MirrorError::ConfigMismatch
    )]
    pub asset: Box<Account<'info, Asset>>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, escrow.transfer_id.as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Box<Account<'info, Escrow>>,
    #[account(
        constraint = title_mint.key() == asset.mint @ MirrorError::MintMismatch,
        constraint = title_mint.key() == escrow.title_mint @ MirrorError::MintMismatch,
        mint::token_program = title_token_program
    )]
    pub title_mint: Box<InterfaceAccount<'info, Mint>>,
    /// CHECK: escrow authority PDA
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
        token::mint = title_mint,
        token::token_program = title_token_program
    )]
    pub destination_title_ata: Box<InterfaceAccount<'info, TokenAccount>>,
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

pub fn handler(ctx: Context<ApplyForcedP7>, message_id: [u8; 32], wire: Vec<u8>) -> Result<()> {
    require!(
        codec::message_id_of_wire(&wire) == message_id,
        MirrorError::InvalidPacket
    );

    require!(
        ctx.accounts.escrow.status_enum() == Some(EscrowStatus::Pending),
        MirrorError::EscrowNotPending
    );

    let packet = codec::decode(&wire).map_err(|_| MirrorError::InvalidPacket)?;
    require!(
        packet.msg_type == MsgType::ForcedTransfer,
        MirrorError::UnsupportedMsgType
    );
    require!(
        packet.version == codec::PACKET_VERSION,
        MirrorError::WrongDomain
    );
    require!(
        packet.dst_chain == ctx.accounts.config.local_chain_id,
        MirrorError::WrongDomain
    );
    require!(
        packet.src_chain == ctx.accounts.config.remote_chain_id,
        MirrorError::WrongDomain
    );
    require!(
        packet.emitter == ctx.accounts.config.eth_endpoint,
        MirrorError::WrongDomain
    );
    require!(
        packet.epoch == ctx.accounts.config.epoch,
        MirrorError::WrongDomain
    );
    require!(packet.payload.len() == 160, MirrorError::InvalidPacket);

    let mut asset_id = [0u8; 32];
    asset_id.copy_from_slice(&packet.payload[0..32]);
    let mut from = [0u8; 32];
    from.copy_from_slice(&packet.payload[32..64]);
    let mut to = [0u8; 32];
    to.copy_from_slice(&packet.payload[64..96]);
    let amount = {
        let mut buf = [0u8; 32];
        buf.copy_from_slice(&packet.payload[96..128]);
        let mut u64buf = [0u8; 8];
        u64buf.copy_from_slice(&buf[24..32]);
        u64::from_be_bytes(u64buf)
    };
    let mut resolution_hash = [0u8; 32];
    resolution_hash.copy_from_slice(&packet.payload[128..160]);

    require!(
        asset_id == ctx.accounts.asset.asset_id,
        MirrorError::MintMismatch
    );
    require!(to != [0u8; 32], MirrorError::ZeroAddress);
    require!(
        resolution_hash != [0u8; 32],
        MirrorError::MissingResolutionHash
    );
    require!(
        ctx.accounts.escrow.seller.to_bytes() == from,
        MirrorError::EscrowCourtMismatch
    );
    require!(
        amount == ctx.accounts.escrow.amount,
        MirrorError::EscrowCourtMismatch
    );
    require_keys_eq!(
        ctx.accounts.destination_title_ata.owner,
        Pubkey::new_from_array(to),
        MirrorError::Unauthorized
    );

    let digest = codec::signing_digest(&packet).map_err(|_| MirrorError::InvalidPacket)?;
    quorum::verify_secp256k1_quorum(
        &ctx.accounts.instructions_sysvar.to_account_info(),
        &digest,
        &ctx.accounts.config.relayers,
        ctx.accounts.config.relayer_count as usize,
        ctx.accounts.config.threshold,
    )?;

    ctx.accounts.processed.bump = ctx.bumps.processed;
    ctx.accounts.processed.message_id = message_id;

    let title_mint_key = ctx.accounts.title_mint.key();
    let auth_bump = ctx.bumps.escrow_authority;
    let auth_seeds: &[&[u8]] = &[ESCROW_AUTHORITY_SEED, title_mint_key.as_ref(), &[auth_bump]];

    let transfer_id = ctx.accounts.escrow.transfer_id;
    let escrow_bump = ctx.accounts.escrow.bump;
    let escrow_seeds: &[&[u8]] = &[ESCROW_SEED, transfer_id.as_ref(), &[escrow_bump]];

    let title_amount = ctx.accounts.escrow.amount;
    let payment_amount = ctx.accounts.escrow.payment_amount;
    let title_decimals = ctx.accounts.title_mint.decimals;
    let payment_decimals = ctx.accounts.payment_mint.decimals;

    // Title escrow → court recipient.
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.title_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.escrow_title_ata.to_account_info(),
                mint: ctx.accounts.title_mint.to_account_info(),
                to: ctx.accounts.destination_title_ata.to_account_info(),
                authority: ctx.accounts.escrow_authority.to_account_info(),
            },
            &[auth_seeds],
        ),
        title_amount,
        title_decimals,
    )?;

    // Payment → original buyer (P7 / P9: never to caller).
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

    ctx.accounts.escrow.status = EscrowStatus::CourtCancelled as u8;
    Ok(())
}
