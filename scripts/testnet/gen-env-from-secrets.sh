#!/usr/bin/env bash
# Build secrets/forge.env from secrets/*.json + Solana program keypair.
# Usage: bash scripts/testnet/gen-env-from-secrets.sh && set -a && source secrets/forge.env && set +a
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

. "${HOME}/.nvm/nvm.sh"
nvm use 22 >/dev/null

PROG="$(solana-keygen pubkey solana/target/deploy/title_mirror-keypair.json)"
REMOTE="$(
  cd solana && node -e "
const {PublicKey}=require('@solana/web3.js');
const pk=new PublicKey(process.argv[1]);
process.stdout.write('0x'+Buffer.from(pk.toBytes()).toString('hex'));
" "$PROG"
)"
BRIDGE_ASSET="0x$(printf 'aa%.0s' {1..32})"

python3 - <<PY
import json
from pathlib import Path

def load(p):
    return json.load(open(p))

roles = Path("secrets/roles")
rel = Path("secrets/relayers")
exports = {
    "ADMIN": load(roles / "admin.json")["address"],
    "GUARDIAN": load(roles / "guardian.json")["address"],
    "ISSUER": load(roles / "issuer.json")["address"],
    "OPERATOR": load(roles / "operator.json")["address"],
    "COURT": load(roles / "court.json")["address"],
    "VERIFIER": load(roles / "verifier.json")["address"],
    "RELAYER1": load(rel / "1.json")["address"],
    "RELAYER2": load(rel / "2.json")["address"],
    "RELAYER3": load(rel / "3.json")["address"],
    "REMOTE_EMITTER": "$REMOTE",
    "BRIDGE_ASSET_ID": "$BRIDGE_ASSET",
    "PRIVATE_KEY": load(roles / "deployer.json")["private_key"],
    "SOLANA_PROGRAM_ID": "$PROG",
}
Path("secrets/forge.env").write_text("\n".join(f'{k}="{v}"' for k, v in exports.items()) + "\n")
print("Wrote secrets/forge.env")
for k in exports:
    if k == "PRIVATE_KEY":
        print(f"{k}=<redacted>")
    else:
        print(f"{k}={exports[k]}")
PY
