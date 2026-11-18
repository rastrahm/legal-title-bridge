use anchor_lang::prelude::*;

use crate::errors::MirrorError;
use crate::quorum;
use crate::state::{Config, CONFIG_SEED, MAX_RELAYERS};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeConfigParams {
    pub eth_endpoint: [u8; 32],
    pub local_chain_id: u64,
    pub remote_chain_id: u64,
    pub threshold: u8,
    pub relayers: Vec<[u8; 20]>,
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = Config::SIZE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeConfig>, params: InitializeConfigParams) -> Result<()> {
    require!(params.eth_endpoint != [0u8; 32], MirrorError::ZeroAddress);
    require!(
        params.local_chain_id != 0
            && params.remote_chain_id != 0
            && params.local_chain_id != params.remote_chain_id,
        MirrorError::WrongDomain
    );

    let n = params.relayers.len();
    quorum::require_threshold(n, params.threshold)?;
    validate_unique_relayers(&params.relayers)?;

    let config = &mut ctx.accounts.config;
    config.bump = ctx.bumps.config;
    config.admin = ctx.accounts.admin.key();
    config.eth_endpoint = params.eth_endpoint;
    config.local_chain_id = params.local_chain_id;
    config.remote_chain_id = params.remote_chain_id;
    config.epoch = 1;
    config.threshold = params.threshold;
    config.relayer_count = n as u8;
    config.relayers = [[0u8; 20]; MAX_RELAYERS];
    for (i, r) in params.relayers.iter().enumerate() {
        require!(*r != [0u8; 20], MirrorError::ZeroAddress);
        config.relayers[i] = *r;
    }
    config.paused = false;
    Ok(())
}

fn validate_unique_relayers(relayers: &[[u8; 20]]) -> Result<()> {
    require!(!relayers.is_empty(), MirrorError::InvalidRelayerSet);
    require!(relayers.len() <= MAX_RELAYERS, MirrorError::TooManyRelayers);
    for i in 0..relayers.len() {
        for j in (i + 1)..relayers.len() {
            require!(relayers[i] != relayers[j], MirrorError::InvalidRelayerSet);
        }
    }
    Ok(())
}
