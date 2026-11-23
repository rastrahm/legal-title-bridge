#!/usr/bin/env bash
# Mint Lab USD (Token-2022, 0 decimals) to one or more Devnet recipients.
# Usage: mint-lab-usd.sh <amount> <recipientPubkey> [moreRecipients...]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MINT_FILE="$ROOT/secrets/deploy/lab-usd-mint.txt"
AMOUNT="${1:?amount required}"
shift
if [[ $# -lt 1 ]]; then
  echo "usage: $0 <amount> <recipientPubkey> [more...]" >&2
  exit 1
fi
if [[ -f "$MINT_FILE" ]]; then
  MINT="$(tr -d '[:space:]' <"$MINT_FILE")"
elif [[ -n "${NEXT_PUBLIC_PAYMENT_MINT:-}" ]]; then
  MINT="$NEXT_PUBLIC_PAYMENT_MINT"
else
  echo "missing Lab USD mint (secrets/deploy/lab-usd-mint.txt)" >&2
  exit 1
fi
for RECIP in "$@"; do
  echo "==> ATA + mint $AMOUNT Lab USD → $RECIP"
  spl-token --program-2022 create-account "$MINT" --owner "$RECIP" --fee-payer ~/.config/solana/id.json 2>/dev/null || true
  spl-token --program-2022 mint "$MINT" "$AMOUNT" --recipient-owner "$RECIP"
done
echo "OK mint=$MINT"
