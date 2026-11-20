//! Relayer quorum via secp256k1 instruction introspection (D10 / R3).

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::Instruction,
    secp256k1_program,
    sysvar::instructions::{load_instruction_at_checked, ID as INSTRUCTIONS_ID},
};

use crate::errors::MirrorError;
use crate::state::MAX_RELAYERS;

/// ⌈2n/3⌉
pub fn min_threshold(n: usize) -> u8 {
    ((2 * n + 2) / 3) as u8
}

pub fn require_threshold(n: usize, threshold: u8) -> Result<()> {
    require!(n >= 3 && n <= MAX_RELAYERS, MirrorError::ThresholdTooLow);
    require!(
        threshold as usize >= min_threshold(n) as usize && (threshold as usize) <= n,
        MirrorError::ThresholdTooLow
    );
    Ok(())
}

/// Defense-in-depth: Instructions account must be the real sysvar (R3 / Wormhole lesson).
pub fn require_instructions_sysvar(info: &AccountInfo) -> Result<()> {
    require_keys_eq!(
        *info.key,
        INSTRUCTIONS_ID,
        MirrorError::InvalidInstructionsSysvar
    );
    Ok(())
}

/// INTENTIONALLY VULNERABLE (REDTEAM / M8): skips Instructions sysvar address check.
#[cfg(feature = "redteam")]
pub fn require_instructions_sysvar_vulnerable(_info: &AccountInfo) -> Result<()> {
    Ok(())
}

/// Verify that prior secp256k1 program instructions attest `message` with ≥ threshold set members.
///
/// Counts **unique Ethereum addresses** in the relayer set (not raw signature count).
pub fn verify_secp256k1_quorum(
    instructions_sysvar: &AccountInfo,
    message: &[u8],
    relayers: &[[u8; 20]],
    relayer_count: usize,
    threshold: u8,
) -> Result<()> {
    require_instructions_sysvar(instructions_sysvar)?;
    require!(threshold > 0, MirrorError::InvalidQuorum);

    let mut matched: [[u8; 20]; MAX_RELAYERS] = [[0u8; 20]; MAX_RELAYERS];
    let mut matched_count: usize = 0;

    // Current instruction index; secp256k1 ixs must appear *before* this program ix.
    let current_index =
        anchor_lang::solana_program::sysvar::instructions::load_current_index_checked(
            instructions_sysvar,
        )
        .map_err(|_| error!(MirrorError::InvalidInstructionsSysvar))?;

    for i in 0..current_index {
        let ix = load_instruction_at_checked(i as usize, instructions_sysvar)
            .map_err(|_| error!(MirrorError::InvalidInstructionsSysvar))?;
        if ix.program_id != secp256k1_program::ID {
            continue;
        }
        collect_matching_signers(
            &ix,
            message,
            relayers,
            relayer_count,
            &mut matched,
            &mut matched_count,
        )?;
    }

    require!(
        matched_count >= threshold as usize,
        MirrorError::InvalidQuorum
    );
    Ok(())
}

fn collect_matching_signers(
    ix: &Instruction,
    message: &[u8],
    relayers: &[[u8; 20]],
    relayer_count: usize,
    matched: &mut [[u8; 20]; MAX_RELAYERS],
    matched_count: &mut usize,
) -> Result<()> {
    let data = &ix.data;
    if data.is_empty() {
        return Ok(());
    }
    let num_sigs = data[0] as usize;
    if num_sigs == 0 {
        return Ok(());
    }
    // Each offsets struct is 11 bytes after the count byte.
    const OFFSETS_SIZE: usize = 11;
    let header_len = 1 + num_sigs * OFFSETS_SIZE;
    if data.len() < header_len {
        return err!(MirrorError::InvalidQuorum);
    }

    for s in 0..num_sigs {
        let base = 1 + s * OFFSETS_SIZE;
        let eth_address_offset = u16::from_le_bytes([data[base + 2], data[base + 3]]) as usize;
        let message_data_offset = u16::from_le_bytes([data[base + 6], data[base + 7]]) as usize;
        let message_data_size = u16::from_le_bytes([data[base + 8], data[base + 9]]) as usize;

        if eth_address_offset + 20 > data.len()
            || message_data_offset + message_data_size > data.len()
        {
            return err!(MirrorError::InvalidQuorum);
        }

        let eth_addr: [u8; 20] = data[eth_address_offset..eth_address_offset + 20]
            .try_into()
            .map_err(|_| error!(MirrorError::InvalidQuorum))?;
        let msg_slice = &data[message_data_offset..message_data_offset + message_data_size];
        if msg_slice != message {
            continue;
        }
        if !is_relayer(&eth_addr, relayers, relayer_count) {
            continue;
        }
        if !contains(matched, *matched_count, &eth_addr) {
            require!(*matched_count < MAX_RELAYERS, MirrorError::InvalidQuorum);
            matched[*matched_count] = eth_addr;
            *matched_count += 1;
        }
    }
    Ok(())
}

fn is_relayer(addr: &[u8; 20], relayers: &[[u8; 20]], count: usize) -> bool {
    relayers.iter().take(count).any(|r| r == addr)
}

fn contains(list: &[[u8; 20]; MAX_RELAYERS], count: usize, addr: &[u8; 20]) -> bool {
    list.iter().take(count).any(|a| a == addr)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn min_threshold_values() {
        assert_eq!(min_threshold(3), 2);
        assert_eq!(min_threshold(4), 3);
        assert_eq!(min_threshold(5), 4);
        assert_eq!(min_threshold(6), 4);
    }

    #[test]
    fn reject_harmony_style_2_of_5() {
        assert!(require_threshold(5, 2).is_err());
        assert!(require_threshold(3, 2).is_ok());
        assert!(require_threshold(2, 2).is_err());
    }

    #[test]
    fn instructions_sysvar_id_is_constant() {
        // R3: the only acceptable key
        assert_eq!(
            INSTRUCTIONS_ID.to_string(),
            "Sysvar1nstructions1111111111111111111111111"
        );
    }

    #[test]
    fn r3_real_rejects_fake_sysvar_key() {
        let fake = Pubkey::new_unique();
        let mut lamports = 0u64;
        let mut data = vec![0u8; 0];
        let owner = Pubkey::new_unique();
        let info = AccountInfo::new(
            &fake,
            false,
            false,
            &mut lamports,
            &mut data,
            &owner,
            false,
            0,
        );
        assert!(require_instructions_sysvar(&info).is_err());
    }

    #[cfg(feature = "redteam")]
    #[test]
    fn r3_vulnerable_skips_sysvar_address() {
        let fake = Pubkey::new_unique();
        let mut lamports = 0u64;
        let mut data = vec![0u8; 0];
        let owner = Pubkey::new_unique();
        let info = AccountInfo::new(
            &fake,
            false,
            false,
            &mut lamports,
            &mut data,
            &owner,
            false,
            0,
        );
        assert!(require_instructions_sysvar_vulnerable(&info).is_ok());
    }
}
