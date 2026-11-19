//! Create DvP escrow: pull title (via escrow authority) + payment from buyer (D3).

use anchor_lang::prelude::*;
use anchor_spl::token_2022::{transfer_checked, Token2022, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::errors::MirrorError;
use crate::state::{
    Asset, Config, Escrow, EscrowStatus, ASSET_SEED, CONFIG_SEED, ESCROW_AUTHORITY_SEED,
    ESCROW_SEED,
};

#[event]
pub struct TransferRequested {
    pub transfer_id: [u8; 32],
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub payment_mint: Pubkey,
    pub payment_amount: u64,
    pub deadline: i64,
    pub hard_deadline: i64,
    pub travel_rule_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct RequestTransferParams {
    pub transfer_id: [u8; 32],
    pub amount: u64,
    pub payment_amount: u64,
    pub deadline: i64,
    pub travel_rule_hash: [u8; 32],
}

#[derive(Accounts)]
#[instruction(params: RequestTransferParams)]
pub struct RequestTransfer<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub seller: Signer<'info>,
    pub buyer: Signer<'info>,
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
        constraint = title_mint.key() == asset.mint @ MirrorError::MintMismatch,
        mint::token_program = title_token_program
    )]
    pub title_mint: Box<InterfaceAccount<'info, Mint>>,
    /// CHECK: escrow authority PDA (I5 path for title moves).
    #[account(seeds = [ESCROW_AUTHORITY_SEED, title_mint.key().as_ref()], bump)]
    pub escrow_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = title_mint,
        token::authority = seller,
        token::token_program = title_token_program
    )]
    pub seller_title_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init,
        payer = payer,
        token::mint = title_mint,
        token::authority = escrow_authority,
        token::token_program = title_token_program
    )]
    pub escrow_title_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mint::token_program = payment_token_program)]
    pub payment_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        token::mint = payment_mint,
        token::authority = buyer,
        token::token_program = payment_token_program
    )]
    pub buyer_payment_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init,
        payer = payer,
        token::mint = payment_mint,
        token::authority = escrow,
        token::token_program = payment_token_program
    )]
    pub escrow_payment_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init,
        payer = payer,
        space = Escrow::SIZE,
        seeds = [ESCROW_SEED, params.transfer_id.as_ref()],
        bump
    )]
    pub escrow: Box<Account<'info, Escrow>>,
    pub title_token_program: Program<'info, Token2022>,
    pub payment_token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RequestTransfer>, params: RequestTransferParams) -> Result<()> {
    require!(params.transfer_id != [0u8; 32], MirrorError::ZeroAddress);
    require!(params.amount > 0, MirrorError::InvalidPacket);
    require!(params.payment_amount > 0, MirrorError::InvalidPacket);
    require!(
        ctx.accounts.seller.key() != ctx.accounts.buyer.key(),
        MirrorError::InvalidPacket
    );

    let now = Clock::get()?.unix_timestamp;
    require!(params.deadline > now, MirrorError::DeadlineInPast);
    let hard_deadline_secs = ctx.accounts.config.hard_deadline_secs;
    let hard_deadline = params
        .deadline
        .checked_add(hard_deadline_secs)
        .ok_or(MirrorError::MathOverflow)?;

    let title_decimals = ctx.accounts.title_mint.decimals;
    let payment_decimals = ctx.accounts.payment_mint.decimals;
    let title_mint_key = ctx.accounts.title_mint.key();
    let payment_mint_key = ctx.accounts.payment_mint.key();
    let asset_key = ctx.accounts.asset.key();
    let seller_key = ctx.accounts.seller.key();
    let buyer_key = ctx.accounts.buyer.key();
    let auth_bump = ctx.bumps.escrow_authority;

    // Title: escrow authority pulls after seller approve (I5).
    let auth_seeds: &[&[u8]] = &[ESCROW_AUTHORITY_SEED, title_mint_key.as_ref(), &[auth_bump]];
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.title_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.seller_title_ata.to_account_info(),
                mint: ctx.accounts.title_mint.to_account_info(),
                to: ctx.accounts.escrow_title_ata.to_account_info(),
                authority: ctx.accounts.escrow_authority.to_account_info(),
            },
            &[auth_seeds],
        ),
        params.amount,
        title_decimals,
    )?;

    // Payment: buyer deposits into escrow-owned vault (X17 mint constrained above).
    transfer_checked(
        CpiContext::new(
            ctx.accounts.payment_token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.buyer_payment_ata.to_account_info(),
                mint: ctx.accounts.payment_mint.to_account_info(),
                to: ctx.accounts.escrow_payment_ata.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        ),
        params.payment_amount,
        payment_decimals,
    )?;

    let escrow = &mut ctx.accounts.escrow;
    escrow.bump = ctx.bumps.escrow;
    escrow.transfer_id = params.transfer_id;
    escrow.asset = asset_key;
    escrow.title_mint = title_mint_key;
    escrow.seller = seller_key;
    escrow.buyer = buyer_key;
    escrow.amount = params.amount;
    escrow.payment_mint = payment_mint_key;
    escrow.payment_amount = params.payment_amount;
    escrow.deadline = params.deadline;
    escrow.hard_deadline = hard_deadline;
    escrow.status = EscrowStatus::Pending as u8;
    escrow.travel_rule_hash = params.travel_rule_hash;

    emit!(TransferRequested {
        transfer_id: params.transfer_id,
        seller: seller_key,
        buyer: buyer_key,
        amount: params.amount,
        payment_mint: payment_mint_key,
        payment_amount: params.payment_amount,
        deadline: params.deadline,
        hard_deadline,
        travel_rule_hash: params.travel_rule_hash,
    });

    Ok(())
}
