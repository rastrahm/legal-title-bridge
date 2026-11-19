#!/usr/bin/env bash
# C17: production frontend bundle must not contain E2E wallet secrets / anvil keys / lab URLs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONT="${ROOT}/frontend"
OUT="${FRONT}/.next"

if [[ ! -d "${OUT}" ]]; then
  echo "check-bundle: missing ${OUT} — run next build first" >&2
  exit 1
fi

# Classic anvil account #0 private key (must never ship).
ANVIL_KEY='0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
SENTINEL='LTB_E2E_WALLET_ADAPTER_v1'
ANVIL_KEYS_FILE='anvil-keys'

fail=0
scan() {
  local pattern="$1"
  local label="$2"
  if grep -R --binary-files=without-match -F -e "${pattern}" "${OUT}" >/dev/null 2>&1; then
    echo "check-bundle FAIL: found ${label} in production .next" >&2
    fail=1
  fi
}

scan "${ANVIL_KEY}" "anvil private key #0"
scan "${SENTINEL}" "E2E wallet sentinel"
scan "${ANVIL_KEYS_FILE}" "anvil-keys marker"

# NEXT_PUBLIC_E2E=1 must not be baked into a production-oriented build artifact as enabled.
if grep -R --binary-files=without-match -E 'NEXT_PUBLIC_E2E["=:]+1' "${OUT}" >/dev/null 2>&1; then
  echo "check-bundle FAIL: NEXT_PUBLIC_E2E=1 present in .next" >&2
  fail=1
fi

if [[ "${fail}" -ne 0 ]]; then
  exit 1
fi

echo "check-bundle: OK (C17)"
