#!/usr/bin/env bash
# Broadcast DeployTestnet.s.sol to Sepolia. Requires funded deployer + secrets/forge.env.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.foundry/bin:${PATH}"
. "${HOME}/.nvm/nvm.sh" && nvm use 22 >/dev/null

bash scripts/testnet/gen-env-from-secrets.sh
set -a
# shellcheck disable=SC1091
source secrets/forge.env
# Prefer Alchemy from .env if present
if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  source .env
fi
set +a

RPC="${SEPOLIA_RPC_URL:?SEPOLIA_RPC_URL required}"
BAL=$(cast balance "$ADMIN" --rpc-url "$RPC" 2>/dev/null || true)
echo "[deploy-sepolia] deployer=$(cast wallet address --private-key "$PRIVATE_KEY")"
echo "[deploy-sepolia] balance=$(cast balance "$(cast wallet address --private-key "$PRIVATE_KEY")" --rpc-url "$RPC") wei"

OUT_DIR=secrets/deploy
mkdir -p "$OUT_DIR"

forge script script/DeployTestnet.s.sol:DeployTestnet \
  --rpc-url "$RPC" \
  --broadcast \
  --private-key "$PRIVATE_KEY" \
  -vvv | tee "$OUT_DIR/sepolia-deploy.log"

echo "[deploy-sepolia] OK — see $OUT_DIR/sepolia-deploy.log and broadcast/"
