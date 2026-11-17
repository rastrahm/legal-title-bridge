#!/usr/bin/env bash
# C0 — forge lint wrapper.
# forge lint often exits 0 even with findings. Fail if the output contains:
#   - forge-style: error[ / warning[ / note[
#   - solc-style diagnostics that cite our trees (src|test|script), not lib/
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.foundry/bin:${PATH}"

TARGETS=("src" "test" "script")
EXISTING=()
for t in "${TARGETS[@]}"; do
  if [[ -d "$t" ]]; then
    EXISTING+=("$t")
  fi
done

if [[ ${#EXISTING[@]} -eq 0 ]]; then
  echo "lint.sh: nothing to lint" >&2
  exit 1
fi

# Optional: lint a single path (used by smoke fixture)
if [[ $# -gt 0 ]]; then
  EXISTING=("$@")
fi

OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT

set +e
forge lint "${EXISTING[@]}" >"$OUT" 2>&1
STATUS=$?
set -e

cat "$OUT"

if [[ $STATUS -ne 0 ]]; then
  echo "lint.sh: forge lint exited with $STATUS" >&2
  exit "$STATUS"
fi

# forge-lint findings on targeted paths
if grep -E 'error\[|warning\[|note\[' "$OUT" >/dev/null; then
  echo "lint.sh: findings detected" >&2
  exit 1
fi

# solc Error/Warning/Note only count when the location is our code (ignore OZ/lib noise)
if grep -E '^\s*--> (src|test|script)/' "$OUT" >/dev/null; then
  echo "lint.sh: findings detected" >&2
  exit 1
fi

echo "lint.sh: clean"
exit 0
