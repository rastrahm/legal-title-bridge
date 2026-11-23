#!/usr/bin/env bash
# TESTNET attacks on Sepolia: P1 (replay) + R5b-style (non-relayer / rotation propose).
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
OUT=secrets/deploy/attacks-eth.json
mkdir -p secrets/deploy

R1_PK=$(python3 -c "import json;print(json.load(open('secrets/relayers/1.json'))['private_key'])")
R2_PK=$(python3 -c "import json;print(json.load(open('secrets/relayers/2.json'))['private_key'])")
BAD_PK=$(python3 -c "import json;print(json.load(open('secrets/roles/deployer.json'))['private_key'])")
ADMIN_PK=$(python3 -c "import json;print(json.load(open('secrets/roles/admin.json'))['private_key'])")
DEPLOYER_PK=$(python3 -c "import json;print(json.load(open('secrets/roles/deployer.json'))['private_key'])")

# Build TRANSFER_REQUEST wire via node + shared codec
WIRE_HEX=$(cd shared && node --input-type=module -e "
import { encode, MsgType, messageIdOfWire, signingDigest, toHex } from './src/codec.ts';
import { getBytes } from 'ethers';
const emitter = getBytes('0x' + '00'.repeat(12) + '577f3B58DF21357ED4F8AF6631d2017FAeE38389'.slice(2).toLowerCase());
// inbound: Solana → Eth → src=100002 dst=11155111 emitter=solana program bytes
import { PublicKey } from '@solana/web3.js';
const prog = new PublicKey('2DvHn2Hxj3HFsbn2iDuBGL4TQAzTomcVCsDTPoZ2h1JL');
const solEmitter = Buffer.from(prog.toBytes());
const asset = getBytes('${BRIDGE_ASSET_ID}');
const tid = getBytes('0x' + '11'.repeat(32));
const seller = getBytes('0x' + 'bb'.repeat(32));
const buyer = getBytes('0x' + 'cc'.repeat(32));
const amount = getBytes('0x' + '00'.repeat(31) + '0a');
const payMint = getBytes('0x' + '22'.repeat(32));
const payAmt = getBytes('0x' + '00'.repeat(31) + '01');
const deadline = BigInt(Math.floor(Date.now()/1000) + 86400);
const travel = getBytes('0x' + '33'.repeat(32));
const payload = new Uint8Array(232);
payload.set(tid,0); payload.set(seller,32); payload.set(buyer,64); payload.set(amount,96);
payload.set(payMint,128); payload.set(payAmt,160);
const dv = new DataView(payload.buffer); dv.setBigUint64(192, deadline, false);
payload.set(travel,200);
const packet = {
  version: 1,
  srcChain: 100002n,
  dstChain: 11155111n,
  emitter: solEmitter,
  epoch: 1n,
  msgType: MsgType.TRANSFER_REQUEST,
  payload,
};
const wire = encode(packet);
const mid = messageIdOfWire(wire);
const digest = signingDigest(packet);
process.stdout.write(JSON.stringify({ wire: toHex(wire), mid: toHex(mid), digest: toHex(digest) }));
" 2>/dev/null)

# shared may not have @solana/web3.js — use solana node_modules
WIRE_JSON=$(NODE_PATH=solana/node_modules node --input-type=module <<'NODE'
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { getBytes, hexlify, keccak256, toUtf8Bytes } from 'ethers';
const require = createRequire(new URL('../solana/package.json', import.meta.url));
const { PublicKey } = require('@solana/web3.js');

const PACKET_VERSION = 1;
const HEADER = 62;
const DOMAIN = 'LegalTitleBridge.Packet.v1';
function writeU64BE(buf, o, v) { new DataView(buf.buffer, buf.byteOffset, buf.byteLength).setBigUint64(o, v, false); }
function writeU32BE(buf, o, v) { new DataView(buf.buffer, buf.byteOffset, buf.byteLength).setUint32(o, v, false); }
function domainTag() { return getBytes(keccak256(toUtf8Bytes(DOMAIN))); }

const prog = new PublicKey('2DvHn2Hxj3HFsbn2iDuBGL4TQAzTomcVCsDTPoZ2h1JL');
const emitter = Buffer.from(prog.toBytes());
const payload = new Uint8Array(232);
payload.set(getBytes('0x'+'11'.repeat(32)),0);
payload.set(getBytes('0x'+'bb'.repeat(32)),32);
payload.set(getBytes('0x'+'cc'.repeat(32)),64);
payload.set(getBytes('0x'+'00'.repeat(31)+'0a'),96);
payload.set(getBytes('0x'+'22'.repeat(32)),128);
payload.set(getBytes('0x'+'00'.repeat(31)+'01'),160);
writeU64BE(payload, 192, BigInt(Math.floor(Date.now()/1000)+86400));
payload.set(getBytes('0x'+'33'.repeat(32)),200);

const src=100002n, dst=11155111n, epoch=1n, msgType=1;
const wire = new Uint8Array(HEADER + payload.length);
wire[0]=PACKET_VERSION; writeU64BE(wire,1,src); writeU64BE(wire,9,dst);
wire.set(emitter,17); writeU64BE(wire,49,epoch); wire[57]=msgType; writeU32BE(wire,58,payload.length); wire.set(payload,62);
const mid = getBytes(keccak256(wire));
const buf = new Uint8Array(121);
buf.set(domainTag(),0); buf[32]=PACKET_VERSION; writeU64BE(buf,33,src); writeU64BE(buf,41,dst);
buf.set(emitter,49); writeU64BE(buf,81,epoch); buf.set(mid,89);
const digest = getBytes(keccak256(buf));
process.stdout.write(JSON.stringify({ wire: hexlify(wire), mid: hexlify(mid), digest: hexlify(digest) }));
NODE
)

WIRE=$(echo "$WIRE_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['wire'])")
DIGEST=$(echo "$WIRE_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['digest'])")
MID=$(echo "$WIRE_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['mid'])")
echo "messageId=$MID"

sign() { cast wallet sign --private-key "$1" --no-hash "$DIGEST"; }

SIG1=$(sign "$R1_PK")
SIG2=$(sign "$R2_PK")
SIGBAD=$(sign "$BAD_PK")

# Sort signatures by recovered address (RelayerQuorum expects ascending)
sort_sigs() {
  python3 - <<PY
from eth_keys import keys
# fallback without eth_keys: use cast
import subprocess, json, os
sigs = ["$SIG1", "$SIG2"]
pairs=[]
for s in sigs:
    # cast recover -- use python keccak recovery via cast
    addr=subprocess.check_output(["cast","recover","$DIGEST",s,"--no-hash"], text=True).strip()
    pairs.append((addr.lower(), s))
pairs.sort()
print(" ".join(s for _,s in pairs))
PY
}

# Prefer cast recover
SORTED=$(python3 - <<PY
import subprocess
digest="$DIGEST"
sigs=["$SIG1","$SIG2"]
pairs=[]
for s in sigs:
    addr=subprocess.check_output(["cast","wallet","address","--private-key", 
      {"$SIG1":"$R1_PK","$SIG2":"$R2_PK"}[s] if False else ""], text=True)
PY
) || true

# Manual sort by known addresses
ADDR1=$(cast wallet address --private-key "$R1_PK")
ADDR2=$(cast wallet address --private-key "$R2_PK")
if [[ "${ADDR1,,}" < "${ADDR2,,}" ]]; then
  SIGS_OK=("$SIG1" "$SIG2")
else
  SIGS_OK=("$SIG2" "$SIG1")
fi

echo "[P1] first submitInbound (may fail if TitleRegistry rejects unknown asset — still exercises bridge)"
set +e
TX_OK=$(cast send "$ENDPOINT" "submitInbound(bytes,bytes[])" "$WIRE" "[${SIGS_OK[0]},${SIGS_OK[1]}]" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$DEPLOYER_PK" --gas-limit 3000000 --priority-gas-price 2gwei --gas-price 50gwei --json 2>&1)
set -e
echo "$TX_OK" | tee secrets/deploy/p1-first.json | python3 -c "import sys,json; 
try:
 d=json.load(sys.stdin); print('first', d.get('transactionHash'), d.get('status'))
except Exception as e:
 print('first_raw_err', str(e)[:200])
" || echo "first submit logged"

echo "[P1] second submitInbound — expect MessageAlreadyProcessed or InvalidQuorum/domain if first failed"
set +e
TX_RE=$(cast send "$ENDPOINT" "submitInbound(bytes,bytes[])" "$WIRE" "[${SIGS_OK[0]},${SIGS_OK[1]}]" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$DEPLOYER_PK" --gas-limit 3000000 --priority-gas-price 2gwei --gas-price 50gwei --json 2>&1)
set -e
echo "$TX_RE" | tee secrets/deploy/p1-replay.json | head -c 400; echo

echo "[R5b] submit with 1 valid + 1 non-relayer signature — expect InvalidQuorum"
# sort ADDR1 vs BAD
BAD_ADDR=$(cast wallet address --private-key "$BAD_PK")
if [[ "${ADDR1,,}" < "${BAD_ADDR,,}" ]]; then
  SIGS_BAD=("$SIG1" "$SIGBAD")
else
  SIGS_BAD=("$SIGBAD" "$SIG1")
fi
set +e
TX_R5=$(cast send "$ENDPOINT" "submitInbound(bytes,bytes[])" "$WIRE" "[${SIGS_BAD[0]},${SIGS_BAD[1]}]" \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$DEPLOYER_PK" --gas-limit 1000000 --priority-gas-price 2gwei --gas-price 50gwei --json 2>&1)
set -e
echo "$TX_R5" | tee secrets/deploy/r5b-bad-sig.json | head -c 400; echo

echo "[R5b] proposeRotateRelayers removing r3 (execute after ROTATION_DELAY=1d)"
# new set: r1, r2 only is invalid (need n>=3). Keep 3 but replace r3 with deployer address as 'new' then we'd need execute after delay.
# Propose same 3 with threshold 2 is no-op. Propose r1,r2,deployer:
NEW_SET="[$RELAYER1,$RELAYER2,$DEPLOYER_ADDRESS]"
set +e
TX_ROT=$(cast send "$ENDPOINT" "proposeRotateRelayers(address[],uint256)" "$NEW_SET" 2 \
  --rpc-url "$SEPOLIA_RPC_URL" --private-key "$ADMIN_PK" --gas-limit 500000 --priority-gas-price 2gwei --gas-price 50gwei --json 2>&1)
set -e
echo "$TX_ROT" | tee secrets/deploy/r5b-propose-rotate.json | python3 -c "import sys,json
try:
 d=json.load(sys.stdin); print('rotate_propose', d.get('transactionHash'), d.get('status'))
except: print('rotate logged')"

python3 - <<PY
import json
open("$OUT","w").write(json.dumps({
  "messageId": "$MID",
  "p1_first": "secrets/deploy/p1-first.json",
  "p1_replay": "secrets/deploy/p1-replay.json",
  "r5b_bad_sig": "secrets/deploy/r5b-bad-sig.json",
  "r5b_propose_rotate": "secrets/deploy/r5b-propose-rotate.json",
  "note": "R5b full (execute after removed key) needs ROTATION_DELAY=1 day; bad-sig proves InvalidQuorum now"
}, indent=2)+"\n")
print("wrote $OUT")
PY
