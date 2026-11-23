# Message protocol — Legal Title Bridge v1

> 🌐 **English** · [Español](./PROTOCOLO-ES.md)

**Language:** English · Phase CODEC.  
**Implementations:** `PacketCodec.sol`, `solana/.../codec.rs`, `shared/src/codec.ts`.  
**Rule C5:** all three languages produce the **same bytes** and the **same** `messageId` / `signingDigest` for each vector in `test/vectors/packets.json`.

Code comments: English (or bilingual). This product document is in English.

---

## 1. Constants

| Name | Value | Notes |
|------|-------|-------|
| `PACKET_VERSION` | `1` | Only version admitted in v1 |
| `HEADER_SIZE` | `62` | Fixed bytes before payload |
| `DOMAIN_TAG` | `keccak256("LegalTitleBridge.Packet.v1")` | Signing digest prefix (D11) |

### Chain identifiers (`uint64`)

| ID | Network |
|----|---------|
| `31337` | Ethereum local (anvil) |
| `11155111` | Ethereum Sepolia |
| `100001` | Solana local (test-validator) |
| `100002` | Solana Devnet |

---

## 2. `MsgType` (closed enum, D8)

| Value | Name | Direction |
|------:|------|-----------|
| `0` | `ISSUE` | Ethereum → Solana |
| `1` | `TRANSFER_REQUEST` | Solana → Ethereum |
| `2` | `TRANSFER_DECISION` | Ethereum → Solana |
| `3` | `FORCED_TRANSFER` | Ethereum → Solana |

Any other value → `UnsupportedMsgType` at the endpoint (later phases).

---

## 3. Wire layout (big-endian)

Every multi-byte integer is **big-endian**. No ABI padding between header fields.

| Offset | Size | Field | Type |
|-------:|-----:|-------|------|
| 0 | 1 | `version` | `uint8` |
| 1 | 8 | `srcChain` | `uint64` |
| 9 | 8 | `dstChain` | `uint64` |
| 17 | 32 | `emitter` | `bytes32` |
| 49 | 8 | `epoch` | `uint64` |
| 57 | 1 | `msgType` | `uint8` |
| 58 | 4 | `payloadLen` | `uint32` |
| 62 | N | `payload` | `bytes` |

`N = payloadLen`. Total packet length = `62 + N`.

Decode must revert if:

- `data.length < 62`
- `version != 1`
- `data.length != 62 + payloadLen`

---

## 4. Derived identifiers

### `messageId`

```
messageId = keccak256(wire_bytes)
```

Hash of the **entire** canonical packet (header + payload). One-byte change ⇒ different id (P1/P2).

### `signingDigest` (relayers, D11)

```
DOMAIN_TAG = keccak256("LegalTitleBridge.Packet.v1")
signingDigest = keccak256(
  DOMAIN_TAG || version || srcChain || dstChain || emitter || epoch || messageId
)
```

Packed big-endian concatenation (same integer rule as the header):

| Field | Size |
|-------|-----:|
| `DOMAIN_TAG` | 32 |
| `version` | 1 |
| `srcChain` | 8 |
| `dstChain` | 8 |
| `emitter` | 32 |
| `epoch` | 8 |
| `messageId` | 32 |
| **Total** | **121** |

The digest does **not** include the raw payload: `messageId` already binds it. It includes epoch and emitter to block cross-deploy / cross-set replays (D11).

---

## 5. Typed payloads (`payload` contents)

Layer-1 codec treats the payload as opaque. v1 layouts (also big-endian / fixed):

### `ISSUE` (0)

| Offset | Size | Field |
|-------:|-----:|-------|
| 0 | 32 | `assetId` |
| 32 | 32 | `amount` (`uint256`) |
| 64 | 32 | `toHolder` (Solana pubkey / `bytes32`) |
| **Total** | **96** | |

### `TRANSFER_REQUEST` (1)

| Offset | Size | Field |
|-------:|-----:|-------|
| 0 | 32 | `transferId` |
| 32 | 32 | `seller` |
| 64 | 32 | `buyer` |
| 96 | 32 | `amount` |
| 128 | 32 | `paymentMint` |
| 160 | 32 | `paymentAmount` |
| 192 | 8 | `deadline` (`uint64`) |
| 200 | 32 | `travelRuleHash` |
| **Total** | **232** | |

### `TRANSFER_DECISION` (2)

| Offset | Size | Field |
|-------:|-----:|-------|
| 0 | 32 | `transferId` |
| 32 | 1 | `outcome` (`0` Approved, `1` Rejected, `2` Expired) |
| 33 | 1 | `reasonCode` (0 if Approved/Expired) |
| 34 | 32 | `amount` |
| **Total** | **66** | |

### `FORCED_TRANSFER` (3)

| Offset | Size | Field |
|-------:|-----:|-------|
| 0 | 32 | `assetId` |
| 32 | 32 | `from` |
| 64 | 32 | `to` |
| 96 | 32 | `amount` |
| 128 | 32 | `resolutionHash` |
| **Total** | **160** | |

- `to == bytes32(0)`: in-kind redemption → Solana **burns** (`apply_forced_transfer` burn path).
- If the title is in `Pending` escrow, Solana uses `apply_forced_p7` (P7: payment to buyer, title to court recipient).

---

## 6. Deadlines (D4–D6 reference)

| Clock | Who | Effect |
|-------|-----|--------|
| `deadline` | Ethereum when deciding | `Approved` only if `now <= deadline` |
| `hardDeadline = deadline + hard_deadline_secs` | Solana | Unilateral refund only afterward; late `Approved` is rejected (D6). Production: `hard_deadline_secs = 7 days`. |

Escrow state detail: see flowchart / DVP phases.

### 6.1 Refund vs late-approval race (P4 / D6)

Documented scenario (residual risk **accepted**):

1. Solana escrow in `Pending`; `now >= hardDeadline`.
2. Any caller runs `refund_after_hard_deadline` → Solana becomes `Refunded` (payment to buyer, title to seller; caller receives no funds — P9).
3. Relayers later deliver a `TRANSFER_DECISION(Approved)` signed on Ethereum (D4 met on time on Eth, but delivery was slow).
4. `apply_decision` on Solana **reverts** with `LateApprovalRejected` (or `EscrowNotPending` if refund already closed).
5. Each chain has its own terminal state: Eth `Approved`, Solana `Refunded`. The reconciler (COURT/RELAY phase) detects the divergence; the operator applies `reconcile` on Ethereum with a resolution hash (D6).

There is no window in which Solana both completes and refunds at once (I4).

---

## 7. Golden vectors

File: `test/vectors/packets.json`.

Each entry includes at least:

- `name`
- `packet` (typed fields + hex `payload`)
- `wire` (hex of canonical encoding)
- `messageId` (32-byte hex)
- `signingDigest` (32-byte hex)

Generation: `forge test --match-test test_WriteGoldenVectors -vv`  
(writes `test/vectors/packets.json`; wrapper `script/GenVectors.s.sol` documents the command).

C5 verification: Solidity tests + `cargo test -p title_mirror codec` + `npm run test:codec` in `shared/`.

---

## 8. Outside this protocol

- Governance (relayers, roles, code) does **not** travel in `MsgType` (D7).
- The frontend does not redefine the layout: it consumes `shared/`.
