#!/usr/bin/env bash
# Deploy title_mirror to Solana Devnet and record the signature.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT/solana"

export PATH="${HOME}/.local/share/solana/install/active_release/bin:${HOME}/.cargo/bin:${PATH}"

RPC="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
solana config set --url "$RPC" >/dev/null

echo "[deploy-solana] balance: $(solana balance)"
echo "[deploy-solana] program: $(solana-keygen pubkey target/deploy/title_mirror-keypair.json)"

# Ensure binary is built
if [[ ! -f target/deploy/title_mirror.so ]]; then
  echo "[deploy-solana] building…"
  anchor build
fi

OUT_DIR="${ROOT}/secrets/deploy"
mkdir -p "$OUT_DIR"

# Deploy (or upgrade if already present)
set +e
DEPLOY_OUT=$(anchor deploy --provider.cluster devnet 2>&1)
STATUS=$?
set -e
echo "$DEPLOY_OUT" | tee "$OUT_DIR/solana-deploy.log"

if [[ $STATUS -ne 0 ]]; then
  echo "[deploy-solana] anchor deploy failed (exit $STATUS); trying solana program deploy…"
  solana program deploy target/deploy/title_mirror.so \
    --program-id target/deploy/title_mirror-keypair.json \
    --url "$RPC" | tee -a "$OUT_DIR/solana-deploy.log"
fi

solana program show "$(solana-keygen pubkey target/deploy/title_mirror-keypair.json)" --url "$RPC" \
  | tee "$OUT_DIR/solana-program-show.txt"

echo "[deploy-solana] OK"
