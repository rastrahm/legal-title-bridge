#!/usr/bin/env bash
# C12 directed mutation (§10.4): each mutant must make ≥1 related test fail.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${HOME}/.foundry/bin:${HOME}/.cargo/bin:${PATH}"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

log() { echo "[mutate] $*"; }
kill_ok=0
kill_fail=0

prepare_copy() {
  rm -rf "${TMP}/repo"
  mkdir -p "${TMP}/repo"
  rsync -a \
    --exclude .git --exclude node_modules --exclude out --exclude cache \
    --exclude frontend --exclude e2e --exclude relayer --exclude doc \
    --exclude broadcast --exclude 'solana/target' --exclude 'solana/.anchor' \
    --exclude lib/forge-std --exclude lib/openzeppelin-contracts \
    "${ROOT}/" "${TMP}/repo/"
  # Reuse installed libs via symlink to speed up
  mkdir -p "${TMP}/repo/lib"
  ln -sfn "${ROOT}/lib/forge-std" "${TMP}/repo/lib/forge-std"
  ln -sfn "${ROOT}/lib/openzeppelin-contracts" "${TMP}/repo/lib/openzeppelin-contracts"
}

expect_fail() {
  local name="$1"
  shift
  log "mutant ${name}: expecting failure…"
  set +e
  "$@"
  local rc=$?
  set -e
  if [[ "${rc}" -eq 0 ]]; then
    log "FAIL ${name}: survivor (tests still green)"
    kill_fail=$((kill_fail + 1))
  else
    log "OK   ${name}: killed"
    kill_ok=$((kill_ok + 1))
  fi
}

forge_match() {
  (cd "${TMP}/repo" && forge test --match-test "$1" -q)
}

cargo_mirror() {
  (cd "${TMP}/repo/solana/programs/title_mirror" && cargo test "$1" -- --nocapture)
}

# --- M1 ---
prepare_copy
sed -i 's/self.seen\[messageId\] = true;/\/\/ MUTANT M1/' "${TMP}/repo/src/libraries/MessageIdSet.sol"
expect_fail M1 forge_match 'test_P1_DuplicateMessageId'

# --- M2 ---
prepare_copy
python3 - <<PY
from pathlib import Path
p = Path("${TMP}/repo/src/BridgeEndpoint.sol")
t = p.read_text()
t = t.replace(
    "if (packet.epoch != epoch) {\n            revert BridgeErrors.WrongDomain();\n        }",
    "// MUTANT M2"
)
p.write_text(t)
PY
expect_fail M2 forge_match 'test_R5b_RemovedRelayerWrongEpoch'

# --- M3 ---
prepare_copy
python3 - <<PY
from pathlib import Path
p = Path("${TMP}/repo/src/TitleRegistry.sol")
t = p.read_text()
t = t.replace(
    "if (block.timestamp > req.deadline) {\n            outcome = DecisionOutcome.Expired;\n            req.status = RequestStatus.Expired;\n        } else {",
    "if (false) { // MUTANT M3\n            outcome = DecisionOutcome.Expired;\n            req.status = RequestStatus.Expired;\n        } else {"
)
p.write_text(t)
PY
expect_fail M3 forge_match 'test_DecideExpired_D4'

# --- M4 ---
prepare_copy
python3 - <<PY
from pathlib import Path
p = Path("${TMP}/repo/src/TitleRegistry.sol")
t = p.read_text()
old = """        if (!attestationRegistry.isCertified(req.assetId)) {
            return (false, ReasonCode.CERTIFICATION_EXPIRED);
        }"""
p.write_text(t.replace(old, "        // MUTANT M4\n"))
PY
expect_fail M4 forge_match 'test_DecideRejectedCertExpired'

# --- M5 ---
prepare_copy
python3 - <<PY
from pathlib import Path
p = Path("${TMP}/repo/src/TitleRegistry.sol")
t = p.read_text()
old = """        if (!identityRegistry.isVerified(req.buyer)) {
            return (false, ReasonCode.NOT_VERIFIED);
        }"""
p.write_text(t.replace(old, "        // MUTANT M5\n"))
PY
expect_fail M5 forge_match 'test_P6_DecideRejected_NotVerified'

# --- M6 ---
prepare_copy
python3 - <<PY
from pathlib import Path
p = Path("${TMP}/repo/src/libraries/FlowLimiter.sol")
t = p.read_text()
t = t.replace(
    "function checkAndConsume(Data storage self, bytes32 assetId, uint256 amount) internal {",
    "function checkAndConsume(Data storage self, bytes32 assetId, uint256 amount) internal {\n        return; // MUTANT M6"
)
p.write_text(t)
PY
expect_fail M6 forge_match 'test_R5c_FlowLimitAndPause'

# --- M7 ---
prepare_copy
python3 - <<PY
from pathlib import Path
p = Path("${TMP}/repo/src/libraries/RelayerQuorum.sol")
t = p.read_text()
t = t.replace(
    "if (n < 3 || threshold < minThreshold(n) || threshold > n) {\n            revert BridgeErrors.ThresholdTooLow();\n        }",
    "if (n < 1 || threshold > n) { // MUTANT M7\n            revert BridgeErrors.ThresholdTooLow();\n        }"
)
p.write_text(t)
PY
expect_fail M7 forge_match 'test_R6_DeployThresholdTooLow'

# --- M8 ---
prepare_copy
python3 - <<PY
from pathlib import Path
p = Path("${TMP}/repo/solana/programs/title_mirror/src/quorum.rs")
t = p.read_text()
t = t.replace(
    """pub fn require_instructions_sysvar(info: &AccountInfo) -> Result<()> {
    require_keys_eq!(
        *info.key,
        INSTRUCTIONS_ID,
        MirrorError::InvalidInstructionsSysvar
    );
    Ok(())
}""",
    """pub fn require_instructions_sysvar(_info: &AccountInfo) -> Result<()> {
    // MUTANT M8
    Ok(())
}"""
)
p.write_text(t)
PY
expect_fail M8 cargo_mirror 'r3_real_rejects_fake_sysvar_key'

# --- M9 ---
prepare_copy
python3 - <<PY
from pathlib import Path
req = Path("${TMP}/repo/solana/programs/title_mirror/src/instructions/request_transfer.rs")
t = req.read_text().replace("token::mint = payment_mint,", "// MUTANT M9", 1)
req.write_text(t)
hook = Path("${TMP}/repo/solana/programs/title_mirror/src/hook.rs")
h = hook.read_text()
h += """
#[cfg(test)]
mod m9_kill {
    #[test]
    fn m9_must_fail_when_mint_constraint_removed() {
        let src = include_str!("instructions/request_transfer.rs");
        assert!(
            src.matches("token::mint = payment_mint").count() >= 2,
            "M9 removed payment mint constraint"
        );
    }
}
"""
hook.write_text(h)
PY
expect_fail M9 cargo_mirror 'm9_must_fail_when_mint_constraint_removed'

# --- M10 ---
prepare_copy
python3 - <<PY
from pathlib import Path
p = Path("${TMP}/repo/solana/programs/title_mirror/src/hook.rs")
t = p.read_text()
t = t.replace(
    """pub fn require_authorized_path(
    authority: &Pubkey,
    permanent_delegate: &Pubkey,
    escrow_authority: &Pubkey,
) -> Result<()> {
    classify_authority(authority, permanent_delegate, escrow_authority).map(|_| ())
}""",
    """pub fn require_authorized_path(
    _authority: &Pubkey,
    _permanent_delegate: &Pubkey,
    _escrow_authority: &Pubkey,
) -> Result<()> {
    // MUTANT M10
    Ok(())
}"""
)
p.write_text(t)
PY
expect_fail M10 cargo_mirror 'allows_delegate_and_escrow'

echo
log "killed=${kill_ok} survivors=${kill_fail}"
if [[ "${kill_fail}" -ne 0 || "${kill_ok}" -ne 10 ]]; then
  log "C12 incomplete"
  exit 1
fi
log "C12 OK (M1–M10)"
