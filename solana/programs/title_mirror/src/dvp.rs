//! Pure DvP time-gate helpers (D5 / D6) — unit-tested without CPI.

use crate::errors::MirrorError;
use crate::state::EscrowStatus;
use anchor_lang::prelude::*;

/// D5: unilateral refund only when Pending and `now >= hard_deadline`.
pub fn require_unilateral_refund(now: i64, hard_deadline: i64, status: EscrowStatus) -> Result<()> {
    require!(
        status == EscrowStatus::Pending,
        MirrorError::EscrowNotPending
    );
    require!(now >= hard_deadline, MirrorError::TooEarlyForRefund);
    Ok(())
}

/// D6: Approved after hardDeadline must be rejected on Solana.
pub fn require_approved_before_hard_deadline(now: i64, hard_deadline: i64) -> Result<()> {
    require!(now < hard_deadline, MirrorError::LateApprovalRejected);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn d5_too_early() {
        assert!(require_unilateral_refund(10, 20, EscrowStatus::Pending).is_err());
    }

    #[test]
    fn d5_ok_at_boundary() {
        assert!(require_unilateral_refund(20, 20, EscrowStatus::Pending).is_ok());
    }

    #[test]
    fn d5_not_pending() {
        assert!(require_unilateral_refund(30, 20, EscrowStatus::Refunded).is_err());
        assert!(require_unilateral_refund(30, 20, EscrowStatus::Completed).is_err());
    }

    #[test]
    fn d6_late_approved() {
        assert!(require_approved_before_hard_deadline(100, 100).is_err());
        assert!(require_approved_before_hard_deadline(101, 100).is_err());
    }

    #[test]
    fn d6_on_time_approved() {
        assert!(require_approved_before_hard_deadline(99, 100).is_ok());
    }
}
