use anchor_lang::prelude::*;

use crate::errors::MirrorError;
use crate::quorum;
use crate::state::{Config, CONFIG_SEED, MAX_RELAYERS};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RotateRelayersParams {
    pub threshold: u8,
    pub relayers: Vec<[u8; 20]>,
}

#[derive(Accounts)]
pub struct RotateRelayers<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ MirrorError::Unauthorized
    )]
    pub config: Account<'info, Config>,
}

pub fn handler(ctx: Context<RotateRelayers>, params: RotateRelayersParams) -> Result<()> {
    let n = params.relayers.len();
    quorum::require_threshold(n, params.threshold)?;
    require!(n <= MAX_RELAYERS, MirrorError::TooManyRelayers);
    for i in 0..n {
        require!(params.relayers[i] != [0u8; 20], MirrorError::ZeroAddress);
        for j in (i + 1)..n {
            require!(
                params.relayers[i] != params.relayers[j],
                MirrorError::InvalidRelayerSet
            );
        }
    }

    let config = &mut ctx.accounts.config;
    config.threshold = params.threshold;
    config.relayer_count = n as u8;
    config.relayers = [[0u8; 20]; MAX_RELAYERS];
    for (i, r) in params.relayers.iter().enumerate() {
        config.relayers[i] = *r;
    }
    config.epoch = config
        .epoch
        .checked_add(1)
        .ok_or(MirrorError::InvalidPacket)?;
    Ok(())
}
