#!/usr/bin/env bash
# Sepolia happy path: verify holder → certify asset → createAsset → issue → OutboundEmitted.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.foundry/bin:${PATH}"
set -a
# shellcheck disable=SC1091
source secrets/forge.env
# shellcheck disable=SC1091
source .env
set +a

IDENTITY="${IDENTITY:-0x2525Db5706d4547B93cF2b608c9809bE2a887EE9}"
ATTEST="${ATTEST:-0x29Ac990fBc054afab565c0270Ae324e48D70603a}"
TITLES="${TITLES:-0x27fE06348f6937f0f980790EC6963633f2D22F2a}"
ENDPOINT="${ENDPOINT:-0x577f3B58DF21357ED4F8AF6631d2017FAeE38389}"
ASSET_ID="${BRIDGE_ASSET_ID}"
HOLDER="0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
EXPIRY=$(( $(date +%s) + 365*24*3600 ))

ISSUER_PK=$(python3 -c "import json;print(json.load(open('secrets/roles/issuer.json'))['private_key'])")
OPERATOR_PK=$(python3 -c "import json;print(json.load(open('secrets/roles/operator.json'))['private_key'])")
VERIFIER_PK=$(python3 -c "import json;print(json.load(open('secrets/roles/verifier.json'))['private_key'])")

GAS=(--gas-limit 800000 --priority-gas-price 2gwei --gas-price 50gwei)
OUT=secrets/deploy/happy-path-eth.json
mkdir -p secrets/deploy

echo "[1] EIP-712 assertion + registerAssertion"
DIGEST=$(cast call "$IDENTITY" "hashAssertion((bytes32,uint16,uint8,uint64))(bytes32)" "($HOLDER,724,1,$EXPIRY)" --rpc-url "$SEPOLIA_RPC_URL")
SIG=$(cast wallet sign --private-key "$VERIFIER_PK" --no-hash "$DIGEST")
TX1=$(cast send "$IDENTITY" "registerAssertion((bytes32,uint16,uint8,uint64),bytes)" "($HOLDER,724,1,$EXPIRY)" "$SIG" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$VERIFIER_PK" "${GAS[@]}" --json)
echo "$TX1" | python3 -c "import sys,json; d=json.load(sys.stdin); print('assertion', d.get('transactionHash'), d.get('status'))"

echo "[2] Certify EXISTENCE + REGISTRAL (issuer + operator)"
for KIND in 0 1; do
  for ROLE_PK in "$ISSUER_PK" "$OPERATOR_PK"; do
    DIGEST=$(cast call "$ATTEST" "hashAttestation(bytes32,uint8,uint64)(bytes32)" "$ASSET_ID" "$KIND" "$EXPIRY" --rpc-url "$SEPOLIA_RPC_URL")
    SIG=$(cast wallet sign --private-key "$ROLE_PK" --no-hash "$DIGEST")
    cast send "$ATTEST" "attest(bytes32,uint8,uint64,bytes)" "$ASSET_ID" "$KIND" "$EXPIRY" "$SIG" \
      --rpc-url "$SEPOLIA_RPC_URL" --private-key "$ROLE_PK" "${GAS[@]}" >/dev/null
  done
done
CERT=$(cast call "$ATTEST" "isCertified(bytes32)(bool)" "$ASSET_ID" --rpc-url "$SEPOLIA_RPC_URL")
echo "isCertified=$CERT"

echo "[3] createAsset"
TX3=$(cast send "$TITLES" "createAsset(bytes32)" "$ASSET_ID" --rpc-url "$SEPOLIA_RPC_URL" --private-key "$ISSUER_PK" "${GAS[@]}" --json)
echo "$TX3" | python3 -c "import sys,json; d=json.load(sys.stdin); print('createAsset', d.get('transactionHash'), d.get('status'))"

echo "[4] issue → OutboundEmitted"
TX4=$(cast send "$TITLES" "issue(bytes32,uint256,bytes32)" "$ASSET_ID" 1000 "$HOLDER" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$ISSUER_PK" --gas-limit 2000000 --priority-gas-price 2gwei --gas-price 50gwei --json)
HASH4=$(echo "$TX4" | python3 -c "import sys,json; print(json.load(sys.stdin).get('transactionHash',''))")
STATUS4=$(echo "$TX4" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")
echo "issue $HASH4 status=$STATUS4"

# Decode OutboundEmitted from receipt logs
python3 - <<PY
import json, subprocess, os
rpc=os.environ["SEPOLIA_RPC_URL"]
h="$HASH4"
raw=subprocess.check_output(["cast","receipt",h,"--rpc-url",rpc,"--json"], text=True)
receipt=json.loads(raw)
topic0=subprocess.check_output(["cast","sig-event","OutboundEmitted(bytes32,uint8,bytes)"], text=True).strip()
# Actually use keccak of event
topic0=subprocess.check_output(["cast","keccak","OutboundEmitted(bytes32,uint8,bytes)"], text=True).strip()
found=False
for log in receipt.get("logs",[]):
    topics=log.get("topics") or []
    if topics and topics[0].lower()==topic0.lower():
        print("OutboundEmitted messageId=", topics[1] if len(topics)>1 else "?")
        found=True
print("outbound_found", found)
print("issue_tx", h)
open("$OUT","w").write(json.dumps({
  "issueTx": h,
  "issueStatus": "$STATUS4",
  "assetId": "$ASSET_ID",
  "holder": "$HOLDER",
  "outboundFound": found,
  "messageId": (receipt.get("logs") or [{}])[0].get("topics",[None,None])[1] if found else None,
}, indent=2)+"\n")
PY

BAL=$(cast call "$TITLES" "balanceOf(bytes32,bytes32)(uint256)" "$ASSET_ID" "$HOLDER" --rpc-url "$SEPOLIA_RPC_URL")
echo "balanceOf=$BAL"
echo "[happy-path-eth] OK → $OUT"
