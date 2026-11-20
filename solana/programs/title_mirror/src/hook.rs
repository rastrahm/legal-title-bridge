//! Token-2022 transfer hook path checks (I5).

use anchor_lang::prelude::*;

use crate::errors::MirrorError;

/// Allowed transfer authorities for mirrored title tokens (I5 / P3).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TransferPath {
    PermanentDelegate,
    EscrowAuthority,
}

/// Returns Ok(path) if `authority` is an authorized mover; otherwise UnauthorizedTransferPath.
pub fn classify_authority(
    authority: &Pubkey,
    permanent_delegate: &Pubkey,
    escrow_authority: &Pubkey,
) -> Result<TransferPath> {
    if authority == permanent_delegate {
        return Ok(TransferPath::PermanentDelegate);
    }
    if authority == escrow_authority {
        return Ok(TransferPath::EscrowAuthority);
    }
    err!(MirrorError::UnauthorizedTransferPath)
}

/// I5: reject any transfer whose authority is not escrow or permanent delegate.
pub fn require_authorized_path(
    authority: &Pubkey,
    permanent_delegate: &Pubkey,
    escrow_authority: &Pubkey,
) -> Result<()> {
    classify_authority(authority, permanent_delegate, escrow_authority).map(|_| ())
}

/// INTENTIONALLY VULNERABLE (REDTEAM / M10): accepts any authority.
#[cfg(feature = "redteam")]
pub fn require_authorized_path_vulnerable(
    _authority: &Pubkey,
    _permanent_delegate: &Pubkey,
    _escrow_authority: &Pubkey,
) -> Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_delegate_and_escrow() {
        let d = Pubkey::new_unique();
        let e = Pubkey::new_unique();
        let other = Pubkey::new_unique();
        assert!(require_authorized_path(&d, &d, &e).is_ok());
        assert!(require_authorized_path(&e, &d, &e).is_ok());
        assert!(require_authorized_path(&other, &d, &e).is_err());
    }

    #[cfg(feature = "redteam")]
    #[test]
    fn p3_vulnerable_allows_stranger() {
        let d = Pubkey::new_unique();
        let e = Pubkey::new_unique();
        let other = Pubkey::new_unique();
        assert!(require_authorized_path_vulnerable(&other, &d, &e).is_ok());
        assert!(require_authorized_path(&other, &d, &e).is_err());
    }
}
