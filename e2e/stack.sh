#!/usr/bin/env bash
# E2E local stack bootstrap (C10).
# Modes:
#   E2E_STACK_MODE=sim   (default) — lightweight marker for in-process Vitest harness
#   E2E_STACK_MODE=full  — anvil + solana-test-validator (+ optional health wait)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK_DIR="${ROOT}/e2e/.stack"
MODE="${E2E_STACK_MODE:-sim}"
mkdir -p "${STACK_DIR}"

export PATH="${HOME}/.foundry/bin:${HOME}/.local/share/solana/install/active_release/bin:${PATH}"

log() { echo "[e2e/stack] $*"; }

stop_full() {
  if [[ -f "${STACK_DIR}/anvil.pid" ]]; then
    kill "$(cat "${STACK_DIR}/anvil.pid")" 2>/dev/null || true
    rm -f "${STACK_DIR}/anvil.pid"
  fi
  if [[ -f "${STACK_DIR}/solana.pid" ]]; then
    kill "$(cat "${STACK_DIR}/solana.pid")" 2>/dev/null || true
    rm -f "${STACK_DIR}/solana.pid"
  fi
}

if [[ "${1:-}" == "stop" ]]; then
  stop_full
  rm -f "${STACK_DIR}/ready" "${STACK_DIR}/env"
  log "stopped"
  exit 0
fi

if [[ "${MODE}" == "sim" ]]; then
  stop_full
  cat > "${STACK_DIR}/env" <<EOF
E2E_STACK_MODE=sim
E2E_ETH_RPC=
E2E_SOL_RPC=
E2E_RELAYERS=3
EOF
  echo "ready $(date -Iseconds)" > "${STACK_DIR}/ready"
  log "sim mode ready (in-process harness; no validators)"
  exit 0
fi

if [[ "${MODE}" != "full" ]]; then
  log "unknown E2E_STACK_MODE=${MODE} (use sim|full)"
  exit 1
fi

command -v anvil >/dev/null || { log "anvil not found"; exit 1; }
command -v solana-test-validator >/dev/null || { log "solana-test-validator not found"; exit 1; }

stop_full

ANVIL_PORT="${E2E_ANVIL_PORT:-8545}"
SOLANA_PORT="${E2E_SOLANA_PORT:-8899}"

log "starting anvil on :${ANVIL_PORT}"
anvil --port "${ANVIL_PORT}" --block-time 1 >"${STACK_DIR}/anvil.log" 2>&1 &
echo $! >"${STACK_DIR}/anvil.pid"

log "starting solana-test-validator on :${SOLANA_PORT}"
solana-test-validator --reset --rpc-port "${SOLANA_PORT}" --quiet >"${STACK_DIR}/solana.log" 2>&1 &
echo $! >"${STACK_DIR}/solana.pid"

# Health wait
for i in $(seq 1 60); do
  if curl -sf -X POST "http://127.0.0.1:${ANVIL_PORT}" \
      -H 'content-type: application/json' \
      -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' >/dev/null \
    && curl -sf "http://127.0.0.1:${SOLANA_PORT}" >/dev/null; then
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    log "timeout waiting for RPCs"
    stop_full
    exit 1
  fi
  sleep 1
done

cat > "${STACK_DIR}/env" <<EOF
E2E_STACK_MODE=full
E2E_ETH_RPC=http://127.0.0.1:${ANVIL_PORT}
E2E_SOL_RPC=http://127.0.0.1:${SOLANA_PORT}
E2E_RELAYERS=3
EOF
echo "ready $(date -Iseconds)" > "${STACK_DIR}/ready"
log "full mode ready eth=${ANVIL_PORT} sol=${SOLANA_PORT}"
log "note: contract/program deploy is owned by later scripts; Vitest harness remains sim-based"
exit 0
