//! Apply FORCED_TRANSFER from Ethereum: court move or in-kind burn (`to == 0`).

use anchor_lang::prelude::*;
use anchor_spl::token_2022::{
    burn_checked, transfer_checked, BurnChecked, Token2022, TransferChecked,
};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::codec::{self, MsgType};
use crate::errors::MirrorError;
use crate::quorum;
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
    let parsed = parse_and_verify_forced(&ctx, &message_id, &wire)?;
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

pub(crate) struct ForcedParts {
    pub from: [u8; 32],
    pub to: [u8; 32],
    pub amount: u64,
}

pub(crate) fn parse_and_verify_forced(
    ctx: &Context<ApplyForcedTransfer>,
    message_id: &[u8; 32],
    wire: &[u8],
) -> Result<ForcedParts> {
    require!(
        codec::message_id_of_wire(wire) == *message_id,
        MirrorError::InvalidPacket
    );
    let packet = codec::decode(wire).map_err(|_| MirrorError::InvalidPacket)?;
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
    require!(amount > 0, MirrorError::InvalidPacket);
    require!(
        resolution_hash != [0u8; 32],
        MirrorError::MissingResolutionHash
    );
    require!(from != [0u8; 32], MirrorError::ZeroAddress);

    let digest = codec::signing_digest(&packet).map_err(|_| MirrorError::InvalidPacket)?;
    quorum::verify_secp256k1_quorum(
        &ctx.accounts.instructions_sysvar.to_account_info(),
        &digest,
        &ctx.accounts.config.relayers,
        ctx.accounts.config.relayer_count as usize,
        ctx.accounts.config.threshold,
    )?;

    Ok(ForcedParts { from, to, amount })
}
