#!/usr/bin/env bash
# TESTNET: executeRotateRelayers (after delay) then X4 old-epoch submitInbound → WrongDomain.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.foundry/bin:${PATH}"
. "${HOME}/.nvm/nvm.sh" && nvm use 22 >/dev/null
set -a
# shellcheck disable=SC1091
source secrets/forge.env
# shellcheck disable=SC1091
source .env
set +a

ENDPOINT="${ENDPOINT:-0x577f3B58DF21357ED4F8AF6631d2017FAeE38389}"
mkdir -p secrets/deploy

ADMIN_PK=$(python3 -c "import json;print(json.load(open('secrets/roles/admin.json'))['private_key'])")
DEPLOYER_PK=$(python3 -c "import json;print(json.load(open('secrets/roles/deployer.json'))['private_key'])")
R1_PK=$(python3 -c "import json;print(json.load(open('secrets/relayers/1.json'))['private_key'])")
R2_PK=$(python3 -c "import json;print(json.load(open('secrets/relayers/2.json'))['private_key'])")

echo "[pre] epoch=$(cast call "$ENDPOINT" "epoch()(uint64)" --rpc-url "$SEPOLIA_RPC_URL")"
echo "[pre] pendingRotation:"
cast call "$ENDPOINT" "pendingRotation()(address[],uint256,uint64,bool)" --rpc-url "$SEPOLIA_RPC_URL" || true

echo "[1] executeRotateRelayers"
set +e
TX_EX=$(cast send "$ENDPOINT" "executeRotateRelayers()" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$ADMIN_PK" \
  --gas-limit 800000 --priority-gas-price 2gwei --gas-price 50gwei --json 2>&1)
EX_EC=$?
set -e
echo "$TX_EX" | tee secrets/deploy/r5b-execute-rotate.json | python3 -c "
import sys,json
raw=sys.stdin.read()
try:
 d=json.loads(raw); print('execute', d.get('transactionHash'), 'status', d.get('status'))
except Exception:
 print('execute_raw', raw[:500])
"
if [[ $EX_EC -ne 0 ]]; then
  echo "executeRotateRelayers failed (exit $EX_EC)" >&2
  exit $EX_EC
fi

EPOCH=$(cast call "$ENDPOINT" "epoch()(uint64)" --rpc-url "$SEPOLIA_RPC_URL")
echo "[post] epoch=$EPOCH"
if [[ "$EPOCH" != "2" ]]; then
  echo "expected epoch 2 after rotation, got $EPOCH" >&2
  exit 1
fi

echo "[2] X4: build epoch-1 TRANSFER_REQUEST + r1/r2 sigs → submitInbound"
# ethers resolves from relayer/package.json
WIRE_JSON=$(cd relayer && node scripts/build-x4-wire.mjs)

WIRE=$(echo "$WIRE_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['wire'])")
DIGEST=$(echo "$WIRE_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['digest'])")
MID=$(echo "$WIRE_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['mid'])")
echo "x4_messageId=$MID"

SIG1=$(cast wallet sign --private-key "$R1_PK" --no-hash "$DIGEST")
SIG2=$(cast wallet sign --private-key "$R2_PK" --no-hash "$DIGEST")
ADDR1=$(cast wallet address --private-key "$R1_PK")
ADDR2=$(cast wallet address --private-key "$R2_PK")
if [[ "${ADDR1,,}" < "${ADDR2,,}" ]]; then
  SIGS=("$SIG1" "$SIG2")
else
  SIGS=("$SIG2" "$SIG1")
fi

set +e
TX_X4=$(cast send "$ENDPOINT" "submitInbound(bytes,bytes[])" "$WIRE" "[${SIGS[0]},${SIGS[1]}]" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$DEPLOYER_PK" \
  --gas-limit 1500000 --priority-gas-price 2gwei --gas-price 50gwei --json 2>&1)
X4_EC=$?
set -e
echo "$TX_X4" | tee secrets/deploy/x4-old-epoch.json | head -c 600; echo

# Expect revert WrongDomain — cast send --json may still print error text
python3 - <<PY
import json, re, pathlib
raw = pathlib.Path("secrets/deploy/x4-old-epoch.json").read_text()
ok = False
# WrongDomain custom error selector
# cast sig "WrongDomain()"
want = "WrongDomain"
if want.lower() in raw.lower() or "0x" in raw and "revert" in raw.lower():
    ok = True
try:
    d=json.loads(raw)
    # unexpected success
    if d.get("status") == "0x1" or d.get("status") == 1:
        ok = False
        print("X4 unexpected SUCCESS", d.get("transactionHash"))
    else:
        ok = True
        print("X4 reverted as tx status", d.get("status"), d.get("transactionHash"))
except Exception:
    if "WrongDomain" in raw or "execution reverted" in raw.lower():
        ok = True
        print("X4 reverted (cli error path) — good")
    else:
        print("X4 ambiguous output")
report={
  "at": __import__("datetime").datetime.utcnow().isoformat()+"Z",
  "executeRotate": json.loads(pathlib.Path("secrets/deploy/r5b-execute-rotate.json").read_text()),
  "epochAfter": "$EPOCH",
  "x4MessageId": "$MID",
  "x4RawHead": raw[:800],
  "x4Blocked": ok,
}
pathlib.Path("secrets/deploy/execute-rotate-x4.json").write_text(json.dumps(report, indent=2)+"\n")
print("wrote secrets/deploy/execute-rotate-x4.json blocked=", ok)
raise SystemExit(0 if ok else 1)
PY
