use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Ping {}

pub fn ping(_ctx: Context<Ping>) -> Result<()> {
    Ok(())
}
