#![allow(deprecated)]
#![allow(ambiguous_glob_reexports)]
#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

pub mod codec;
pub mod hook;
pub mod instructions;
pub mod quorum;
pub mod state;

pub use instructions::*;

declare_id!("H4fc36LTnKLeGfdT5UUCa8d39VM3Q1Z4N8Myf8uc4nRU");

#[program]
pub mod title_mirror {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize(ctx)
    }

    pub fn ping(ctx: Context<Ping>) -> Result<()> {
        instructions::ping(ctx)
    }
}
