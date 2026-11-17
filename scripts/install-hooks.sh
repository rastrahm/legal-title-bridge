#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$ROOT/.git/hooks/pre-commit"
mkdir -p "$ROOT/.git/hooks"
cp "$ROOT/scripts/pre-commit" "$HOOK"
chmod +x "$HOOK"
echo "Installed pre-commit hook -> $HOOK"
