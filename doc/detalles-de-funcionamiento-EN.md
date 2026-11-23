# How it works — Legal Title Bridge

> 🌐 **English** · [Español](./detalles-de-funcionamiento-ES.md)

**Language:** English · Orientation doc on structure and flows.  
**Scope:** Sepolia + Solana Devnet lab (not production).  
**Governance rule:** Ethereum commands; the frontend is not truth (D14); codec aligned in three languages (C5).

---

## 1. Monorepo overview

Ethereum ↔ Solana bridge for legal titles. Main pieces:

| Folder | Role |
|--------|------|
| `src/` | Solidity contracts (Foundry): registries, bridge, compliance, libraries |
| `test/` | Foundry tests (unit, invariant, mocks, redteam, extatk) |
| `solana/` | Anchor program `title_mirror` + Devnet tests/scripts |
| `shared/` | Protocol kit: codec, networks, addresses (Zod) |
| `relayer/` | Off-chain messenger (Node.js): watchers, signing, delivery, GET API |
| `frontend/` | Next.js 16: assets, bridge, wallet, operator, verifier |
| `e2e/` | Local Anvil+Solana stack + lifecycle/failure scenarios |
| `doc/` | Documentation (plan, protocols, security, QA) |
| `script/` / `scripts/` | Foundry deploy vs bash/hooks/lint utilities |
| `secrets/` | Lab keys (deploy, relayers, roles) |
| `lib/` | Foundry dependencies (OpenZeppelin, forge-std) |
| `broadcast/` / `out/` / `cache/` | Generated forge artifacts |

```mermaid
flowchart TB
  ROOT["22-legal-title-bridge"]

  ROOT --> ETH["Ethereum / Foundry"]
  ROOT --> SOL["Solana / Anchor"]
  ROOT --> SHARED["shared/"]
  ROOT --> REL["relayer/"]
  ROOT --> FE["frontend/"]
  ROOT --> E2E["e2e/"]
  ROOT --> DOC["doc/"]

  ETH --> SRC["src/"]
  ETH --> TEST["test/"]
  ETH --> SCRIPT["script/"]

  SOL --> PROG["programs/title_mirror/"]

  SHARED --> CODEC["codec + addresses + network"]
  REL --> WATCH["watchers + submitter + status API"]
```

### Flow between pieces

```mermaid
flowchart LR
  FE["frontend"] --> SHARED
  REL["relayer"] --> SHARED
  E2E["e2e"] --> SHARED
  SHARED["shared"] --> ETH["src/ Ethereum"]
  SHARED --> SOL["solana/title_mirror"]
  REL --> ETH
  REL --> SOL
```

`shared/` is the data hub (bytes, networks, addresses). The relayer watches both chains and delivers messages. On-chain validates quorum and changes state.

---

## 2. Ethereum — `src/` by function

```mermaid
flowchart TB
  subgraph REG["Registries"]
    TR["TitleRegistry.sol"]
    IR["IdentityRegistry.sol"]
    AR["AttestationRegistry.sol"]
  end

  subgraph BR["Bridge"]
    BE["BridgeEndpoint.sol"]
  end

  subgraph COMP["Compliance"]
    CM["CountryModule"]
    LM["LockupModule"]
    MH["MaxHoldersModule"]
  end

  subgraph LIB["Libraries"]
    PC["PacketCodec"]
    RQ["RelayerQuorum"]
    MIS["MessageIdSet"]
    FL["FlowLimiter"]
    LC["LedgerChain"]
  end

  TR --> COMP
  BE --> LIB
  TR -.-> AR
  TR -.-> IR
```

### Registries (root of `src/`)

| File | Function |
|------|----------|
| `TitleRegistry.sol` | Asset lifecycle and DvP / transfers on Ethereum |
| `IdentityRegistry.sol` | Holder identity (EIP-712, Solana key as `bytes32`) |
| `AttestationRegistry.sol` | Asset certifications (existence + registry, quorum) |

- Interfaces: `interfaces/IIdentityRegistry.sol`, `IAttestationRegistry.sol`
- Errors: `errors/RegistryErrors.sol`
- `TitleRegistry` has no dedicated interface under `interfaces/`

### Bridge

| File | Function |
|------|----------|
| `BridgeEndpoint.sol` | Quorum inbound (`submitInbound`), typed outbound (`emitOutbound`), pause, relayer rotation |

- Interface: `interfaces/IBridgeEndpoint.sol`
- Errors: `errors/BridgeErrors.sol`
- Key events: `OutboundEmitted(messageId, msgType, wire)`, `InboundProcessed(messageId, msgType)`

### Compliance (`src/compliance/`)

Modules consulted by `TitleRegistry` before approving a transfer (`IComplianceModule`):

| File | Rule |
|------|------|
| `CountryModule.sol` | Buyer country on allowlist |
| `LockupModule.sol` | Temporary holder lockup |
| `MaxHoldersModule.sol` | Cap on holders with balance > 0 |

### Libraries (`src/libraries/`)

| File | Function |
|------|----------|
| `PacketCodec.sol` | Cross-chain packet encode/decode (C5) |
| `RelayerQuorum.sol` | Threshold and ECDSA verification of relayers |
| `MessageIdSet.sol` | Idempotency of inbound `messageId`s |
| `FlowLimiter.sol` | Per-asset / per-transfer flow caps |
| `LedgerChain.sol` | Ledger hash chain |

- Codec errors: `errors/CodecErrors.sol`
- `Smoke.sol` is a toolchain placeholder (BOOT), not product logic

---

## 3. Solana — `title_mirror` by function

On Solana there is not a set of separate programs: everything lives in **`title_mirror`**. Identity/Attestation stay on Ethereum.

```mermaid
flowchart TB
  subgraph STATE["State ≈ registries / PDAs"]
    CFG["Config"]
    AST["Asset"]
    PM["ProcessedMessage"]
    ESC["Escrow"]
  end

  subgraph BR["Bridge ≈ inbound Eth → Sol"]
    II["apply_issue"]
    AD["apply_decision"]
    AFT["apply_forced_transfer"]
    P7["apply_forced_p7"]
    RR["rotate_relayers"]
  end

  subgraph COMP["Compliance ≈ transfer paths"]
    TH["transfer_hook"]
    HK["hook.rs"]
  end

  subgraph LIB["Libraries / helpers"]
    COD["codec.rs"]
    QUO["quorum.rs"]
    DVP["dvp.rs"]
    ERR["errors.rs"]
  end

  BR --> STATE
  BR --> LIB
  COMP --> STATE
```

### State ≈ registries (`state/mod.rs`)

| PDA account | Role (Eth analogue) |
|-------------|---------------------|
| `Config` | Remote endpoint + relayers + pause + deadlines |
| `Asset` | Per-`assetId` mirror + Token-2022 mint |
| `ProcessedMessage` | `messageId` idempotency |
| `Escrow` | DvP Pending → Completed / Refunded / CourtCancelled |

Seeds: `config`, `asset`, `processed`, `escrow`, `permanent_delegate`, `escrow_authority`, `extra-account-metas`.

### Bridge (`instructions/` + `quorum.rs`)

| Instruction | Function |
|-------------|----------|
| `initialize_config` / `rotate_relayers` | Relayer set bootstrap and rotation |
| `apply_issue` | Applies ISSUE from Eth (mirror mint) |
| `apply_decision` | Applies DvP decision |
| `apply_forced_transfer` | Forced transfer |
| `apply_forced_p7` | Forced with Pending escrow (court cut) |
| `request_transfer` / `refund_after_hard_deadline` | Local DvP + unilateral refund (D5) |

Relevant Solana event for Sol→Eth: `TransferRequested` in `request_transfer`.

### Compliance (`hook.rs` + `transfer_hook`)

No Country/Lockup/MaxHolders. The rule is **I5**: only the escrow or the permanent delegate may move the title.

| Piece | Function |
|-------|----------|
| `hook.rs` | Classifies authority (`TransferPath`) |
| `transfer_hook` | Token-2022 entry; rejects unauthorized paths |
| feature `redteam` | Intentionally vulnerable variant |

### Libraries

| Module | Eth analogue | Function |
|--------|--------------|----------|
| `codec.rs` | `PacketCodec.sol` | LTB wire (must match Eth + `shared/`) |
| `quorum.rs` | `RelayerQuorum.sol` | ⌈2n/3⌉ + secp256k1 via Instructions sysvar |
| `dvp.rs` | deadline helpers | Unilateral refund / reject post–hard deadline |
| `errors.rs` | `*Errors.sol` | `MirrorError` |

### Eth ↔ Sol parallel

| Function | Ethereum (`src/`) | Solana (`title_mirror`) |
|----------|-------------------|-------------------------|
| Registries | `Title` / `Identity` / `Attestation` | PDAs `Asset` + `Escrow` (identity/attest only on Eth) |
| Bridge | `BridgeEndpoint` | `apply_*` + `Config` + `quorum` |
| Compliance | `compliance/*` | `hook` / `transfer_hook` |
| Libraries | `libraries/*` | `codec` / `quorum` / `dvp` |

---

## 4. Shared and Relayer — the off-chain bridge

**Nuance:** `shared/` is not the runtime bridge; it is the **protocol kit**. The **messenger** is `relayer/` (Node.js). On-chain endpoints remain `BridgeEndpoint` + `title_mirror`.

```mermaid
flowchart TB
  subgraph ONCHAIN["On-chain (truth)"]
    ETH["Ethereum<br/>BridgeEndpoint + registries"]
    SOL["Solana<br/>title_mirror"]
  end

  subgraph SHARED["shared/ — common language"]
    COD["codec.ts<br/>Packet / MsgType / messageId / digest"]
    ADDR["addresses.ts<br/>addresses per network"]
    NET["network.ts<br/>local | sepolia-devnet"]
    DEP["deployments/*.json"]
  end

  subgraph REL["relayer/ — off-chain messenger"]
    WE["watcher-eth"]
    WS["watcher-sol"]
    ST["store SQLite"]
    SG["signer"]
    SU["submitter"]
    RC["reconciler"]
    API["status-api GET"]
  end

  FE["frontend / e2e"]

  ETH -->|"OutboundEmitted"| WE
  SOL -->|"finalized events"| WS
  WE --> ST
  WS --> ST
  ST --> SG
  SG --> SU
  SU -->|"wire + quorum signatures"| ETH
  SU -->|"wire + quorum signatures"| SOL
  ST --> API
  RC --> API
  API -->|"read-only"| FE

  SHARED -.->|"same wire / ids"| ETH
  SHARED -.->|"same wire / ids"| SOL
  SHARED -.-> REL
  SHARED -.-> FE
```

### `shared/` — contents

| Piece | Contains | Purpose |
|-------|----------|---------|
| `codec.ts` | `MsgType`, encode/decode, `messageId`, `signingDigest` | Same bytes as `PacketCodec.sol` and `codec.rs` |
| `addresses.ts` | Zod + Eth/Sol addresses per network | D14: nobody takes addresses from the URL |
| `network.ts` | `'local' \| 'sepolia-devnet'` | Environment identifier |
| `deployments/` | Post-deploy JSON | Source of real addresses |
| `index.ts` | Re-exports | Single import surface |

It does not watch chains or sign. It only defines the data contract.

### `relayer/` — message pipeline

```mermaid
sequenceDiagram
  participant Src as Source chain
  participant W as Watcher
  participant Store as MessageStore
  participant Sign as Signer
  participant Sub as Submitter
  participant Dst as Destination chain

  Src->>W: bridge event (wire)
  W->>W: wait for finality
  W->>Store: insert seen → finalized
  Sign->>Store: sign digest (secp256k1)
  Note over Store: signatures ≥ ⌈2n/3⌉ → quorum_ready
  Sub->>Dst: deliver(wire + signatures)
  Store->>Store: submitted → delivered
```

| Module | Role |
|--------|------|
| `watcher-eth.ts` | Reads Eth outbound; finality by confirmations or `finalized` tag |
| `watcher-sol.ts` | Reads Sol events; `finalized` commitment only |
| `store.ts` | SQLite: unique `messageId`, states, exponential retries |
| `signer.ts` | Signs the `signingDigest` (no EIP-191 prefix) |
| `submitter.ts` | Collects signatures; with quorum delivers to destination |
| `reconciler.ts` | I2 (Eth=Sol supply) and D6 (Approved vs Refunded) |
| `status-api.ts` | HTTP GET `/status` and `/messages` |
| `types.ts` | Directions `eth_to_sol` / `sol_to_eth` and states |

Message states: `seen → finalized → signed → quorum_ready → submitted → delivered` (or `failed`).

### Message types (`MsgType`, D8)

| MsgType | Direction | Typical origin | Destination applies |
|--------:|-----------|----------------|---------------------|
| `ISSUE` (0) | Eth → Sol | Ethereum | `apply_issue` |
| `TRANSFER_REQUEST` (1) | Sol → Eth | Solana (DvP) | `BridgeEndpoint.submitInbound` |
| `TRANSFER_DECISION` (2) | Eth → Sol | Ethereum | `apply_decision` |
| `FORCED_TRANSFER` (3) | Eth → Sol | Ethereum | `apply_forced_*` |

In one line:

- **`shared/`** = bridge dictionary (bytes, networks, addresses).
- **`relayer/`** = courier that sees a finalized event, stores it, signs in quorum, and delivers.
- **On-chain** = who validates quorum and changes state; the relayer is not an authority.

---

## 5. ISSUE map (Eth → Sol)

```mermaid
sequenceDiagram
  participant TR as TitleRegistry.sol
  participant BE as BridgeEndpoint.sol
  participant RPC_E as Ethereum RPC
  participant W as watcher-eth.ts
  participant ST as store.ts
  participant SG as signer.ts
  participant SU as submitter.ts
  participant RPC_S as Solana RPC
  participant TM as title_mirror apply_issue

  TR->>BE: emitOutbound(ISSUE, payload)
  BE->>BE: PacketCodec.encode → messageId
  BE-->>RPC_E: OutboundEmitted(messageId, msgType, wire)

  loop poll()
    W->>RPC_E: getOutboundEvents(from, head)
    RPC_E-->>W: OutboundEmitted logs
    W->>W: finality? (confirmations or finalized tag)
  end

  W->>ST: insert finalized (eth_to_sol)
  SG->>ST: digest signatures (quorum ⌈2n/3⌉)
  SU->>RPC_S: deliver(wire + signatures)
  RPC_S->>TM: apply_issue(message_id, wire)
  TM->>TM: quorum + ProcessedMessage + mint
```

Key files: `TitleRegistry` → `BridgeEndpoint.emitOutbound` → `watcher-eth` → `store` / `signer` / `submitter` → `apply_issue`.

---

## 6. DvP map (REQUEST Sol→Eth, then DECISION Eth→Sol)

```mermaid
sequenceDiagram
  participant User as Seller/Buyer
  participant TM as title_mirror
  participant RPC_S as Solana RPC
  participant WS as watcher-sol.ts
  participant ST as store / signer / submitter
  participant RPC_E as Ethereum RPC
  participant BE as BridgeEndpoint
  participant TR as TitleRegistry
  participant WE as watcher-eth.ts

  User->>TM: request_transfer(...)
  TM->>TM: escrow Pending + title/payment
  TM-->>RPC_S: TransferRequested event
  Note over TM,ST: Relayer builds TRANSFER_REQUEST wire<br/>(shared codec) and signs it

  loop poll finalized
    WS->>RPC_S: getEvents(finalized)
  end
  WS->>ST: sol_to_eth
  ST->>BE: submitInbound(wire, signatures)
  BE->>TR: dispatch TRANSFER_REQUEST

  TR->>BE: emitOutbound(TRANSFER_DECISION, ...)
  BE-->>RPC_E: OutboundEmitted

  WE->>RPC_E: getOutboundEvents + finality
  WE->>ST: eth_to_sol
  ST->>TM: apply_decision(message_id, wire)
  TM->>TM: Completed / Rejected / refund rules D5-D6
```

---

## 7. How the Node relayer “receives” events

The process does **not** get push from the chain. It **polls** RPCs: reads logs/events, waits for finality, signs, and **pushes** a tx to the other chain.

```mermaid
flowchart LR
  subgraph READ["RPC read-only"]
    E["JSON-RPC Eth<br/>OutboundEmitted logs"]
    S["JSON-RPC Sol<br/>TransferRequested logs"]
  end

  subgraph NODE["relayer Node.js"]
    W1["WatcherEth"]
    W2["WatcherSol"]
    CORE["store → signer → submitter"]
  end

  subgraph WRITE["Tx write"]
    TO_SOL["tx apply_* on Solana"]
    TO_ETH["tx submitInbound on Eth"]
  end

  E --> W1 --> CORE
  S --> W2 --> CORE
  CORE --> TO_SOL
  CORE --> TO_ETH
```

### Eth → Sol (detail)

1. On Eth, `TitleRegistry` (or another role) calls `BridgeEndpoint.emitOutbound` → log **`OutboundEmitted(messageId, msgType, wire)`**.
2. `WatcherEth.poll()` uses an `EthBlockSource` adapter:
   - `getBlockNumber` / `getFinalizedBlockNumber`
   - `getOutboundEvents(from, to)` → in practice `eth_getLogs` of `bridgeEndpoint` from `shared/addresses`
3. Only if the block is final (`confirmations` or `finalized` tag) → `MessageStore`
4. Relayers sign the `signingDigest` (same codec in three languages)
5. With quorum, `Submitter` sends a Solana tx: `apply_issue` / `apply_decision` / `apply_forced_*`
6. On-chain Solana re-validates quorum (secp256k1 + Instructions sysvar) and applies the effect

**Model:** Eth RPC (read) → Node → Sol RPC (write).

### Sol → Eth (detail)

1. `request_transfer` emits **`TransferRequested`**; the `TRANSFER_REQUEST` wire is built with the canonical codec
2. `WatcherSol.poll()` requires **`finalized`** commitment via `SolEventSource.getEvents`
3. Dedup by `messageId` → store with direction `sol_to_eth`
4. Sign + quorum
5. Deliver on Eth: **`BridgeEndpoint.submitInbound(wire, signatures)`** (permissionless; valid quorum matters)
6. Eth marks `messageId` processed and dispatches to the registry

**Model:** Sol RPC (read) → Node → Eth RPC (write).

### Adapter design

Watchers do **not** embed a concrete RPC client; they receive injectable interfaces:

- `EthBlockSource` / `SolEventSource` (read)
- `DeliveryTransport` (write)

Tests/e2e inject fakes (`e2e/src/sim/relayer-fleet.ts`). On testnet the real adapter talks to Sepolia / Devnet.

---

## 8. Related references

- Message protocol (wire, digests): [`PROTOCOLO-ES.md`](./PROTOCOLO-ES.md)
- Planning and decisions D1–D14: [`planificacion-EN.md`](./planificacion-EN.md)
- Milestones: [`hitos-ES.md`](./hitos-ES.md)
- Testnet deploy: [`DEPLOY-TESTNET-ES.md`](./DEPLOY-TESTNET-ES.md)
- Repo README: [`../README-EN.md`](../README-EN.md)
