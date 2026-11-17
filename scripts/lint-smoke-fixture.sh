#!/usr/bin/env bash
# BOOT control: a file with an intentional forge-lint finding MUST make lint.sh fail.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.foundry/bin:${PATH}"

FIX_DIR="test/lint_fixture"
FIX_FILE="$FIX_DIR/BadLint.sol"
mkdir -p "$FIX_DIR"

cleanup() {
  rm -rf "$FIX_DIR"
}
trap cleanup EXIT

cat >"$FIX_FILE" <<'EOF'
// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @dev Intentional fixture so scripts/lint.sh fails on findings.
contract BadLint {
    uint256 public x;

    function set(uint256 y) external {
        uint256 unused = y; // unused on purpose for lint smoke
        x = y;
    }
}
EOF

set +e
./scripts/lint.sh "$FIX_DIR" >/tmp/ltb-lint-smoke.out 2>&1
STATUS=$?
set -e

if [[ $STATUS -eq 0 ]]; then
  echo "lint-smoke-fixture: EXPECTED failure but lint.sh passed" >&2
  cat /tmp/ltb-lint-smoke.out >&2
  exit 1
fi

echo "lint-smoke-fixture: OK (lint.sh failed as expected)"
exit 0
