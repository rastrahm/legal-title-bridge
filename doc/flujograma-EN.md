# Operational flowcharts — Legal Title Bridge

> 🌐 **English** · [Español](./flujograma-ES.md)

**Language:** English · Module 22 · **as-built** (TESTNET closed · SOLV closed 2026-11-23).  
**Source:** [`planificacion-EN.md`](./planificacion-EN.md) §6, §11–§12, D1–D6.  
**Companion:** [`diagrama-de-flujo-EN.md`](./diagrama-de-flujo-EN.md) (per-operation decisions).

End-to-end **operational** flowcharts: project phases, asset lifecycle, bridge, deadlines, and close on both testnets.

---

## 1. Master module flowchart (phases)

```mermaid
flowchart TB
    BOOT[BOOT scaffold] --> CODEC[CODEC golden vectors]
    CODEC --> TITLE[TITLE registry + identity]
    TITLE --> ATTEST[ATTEST certifications]
    ATTEST --> ENDPOINT[ENDPOINT Eth bridge]
    ENDPOINT --> MIRROR[MIRROR Solana program]
    MIRROR --> DVP[DVP escrow + deadlines]
    DVP --> COURT[COURT order + D6]
    COURT --> RELAY[RELAY 3 processes]
    RELAY --> E2E[E2E local stack]
    E2E --> FRONT[FRONT Next.js]
    FRONT --> REDTEAM[REDTEAM R/P/W/M]
    REDTEAM --> QA[QA human agent]
    QA --> EXTATK[EXTATK X1-X36 other agent]
    EXTATK --> TESTNET[TESTNET Sepolia + Devnet]
    TESTNET --> SOLV[SOLV v1 close]

    BOOT -.->|Authorize Phase| GATE{{Mandatory gate}}
    GATE -.-> CODEC
```

Each arrow requires: *"Autorizo Fase \<ID\>"* + exit criterion. Board: [`hitos-ES.md`](./hitos-ES.md).

---

## 2. Asset lifecycle (bonded warehouse wine)

```mermaid
flowchart TB
    subgraph PRE["Preparation"]
        P1[Register buyer/seller identity] --> P2[Existence + registry certifications]
        P2 --> P3{Certifier quorum?}
        P3 -->|No| P0[Issuance blocked]
        P3 -->|Yes| P4[Asset ready]
    end

    subgraph EMISION["Issuance"]
        E1[issue in TitleRegistry] --> E2[ISSUE → Solana mint]
        E2 --> E3[I2 supply aligned]
    end

    subgraph TRADE["DvP transfer"]
        T1[Seller: token → escrow] --> T2[Buyer: payment → escrow]
        T2 --> T3[TRANSFER_REQUEST → Eth]
        T3 --> T4{Eth decision}
        T4 -->|Approved| T5[Cross release on Solana]
        T4 -->|Rejected| T6[Refund]
        T4 -->|Expired| T6
        T5 --> T7[Completed]
        T6 --> T8[Refunded]
    end

    subgraph COURT["Exceptions"]
        C1[Court order FORCED_TRANSFER]
        C2[D6 reconciliation]
        C3[Redeem in kind]
    end

    P4 --> E1
    E3 --> T1
    T7 --> END1([Title updated on Eth + Sol])
    T8 --> END2([Terminal state without double payout])
    E3 --> C1
    T3 --> C1
    T4 --> C2
    E3 --> C3
```

---

## 3. Happy path — delivery versus payment

```mermaid
sequenceDiagram
    autonumber
    actor V as Seller Phantom
    actor C as Buyer Phantom
    participant Sol as title_mirror
    participant Rel as Relayers 2/3
    participant Eth as TitleRegistry + Endpoint
    actor Op as Operator MetaMask

    V->>Sol: request_transfer (token → escrow)
    C->>Sol: deposit payment → escrow
    Sol->>Rel: TRANSFER_REQUEST event
    Rel->>Eth: submitInbound TRANSFER_REQUEST
    Eth->>Eth: Request Pending
    Op->>Eth: decide Approved (before deadline)
    Eth->>Rel: TRANSFER_DECISION event
    Rel->>Sol: apply_decision Approved
    Sol->>V: payment released
    Sol->>C: token released
    Note over Eth,Sol: I4 Completed · I2 OK · I6 payment conserved
```

---

## 4. Rejection / expiry / D6 path

```mermaid
sequenceDiagram
    autonumber
    participant Sol as title_mirror
    participant Rel as Relayers
    participant Eth as Ethereum
    participant Rec as Reconciler
    actor Op as Operator

    Note over Eth: Case A — Rejected/Expired on time
    Eth->>Rel: TRANSFER_DECISION Rejected/Expired
    Rel->>Sol: apply_decision
    Sol->>Sol: Refunded (before hardDeadline)

    Note over Sol,Eth: Case B — Relayers down past hardDeadline
    Sol->>Sol: refund_after_hard_deadline
    Eth-->>Rel: Late Approved
    Rel->>Sol: apply_decision Approved
    Sol-->>Sol: REJECTS (D6)
    Rec->>Rec: detects I2/state divergence
    Rec->>Op: alert
    Op->>Eth: reconcile + resolutionHash
    Note over Eth,Sol: Procedure proven in E2E F4
```

---

## 5. Deadline timeline (D4–D6)

```mermaid
flowchart LR
    subgraph T["Time →"]
        T0[request + deadline set]
        T1[Eth deadline]
        T2[hardDeadline = deadline + 7d]
        T3[after]
    end

    T0 --> T1 --> T2 --> T3

    T0 -.-> A["Eth may Approved / Rejected"]
    T1 -.-> B["Eth only Expired — no Approved"]
    T0 -.-> C["Solana: refund only with signed decision"]
    T2 -.-> D["Solana: unilateral refund allowed"]
    T3 -.-> E["Late Approved: rejected · D6"]
```

---

## 6. Cross-chain messaging (closed enum)

```mermaid
flowchart LR
    subgraph OUT_ETH["Ethereum → Solana"]
        M1[ISSUE]
        M2[TRANSFER_DECISION]
        M3[FORCED_TRANSFER]
    end

    subgraph OUT_SOL["Solana → Ethereum"]
        M4[TRANSFER_REQUEST]
    end

    ETH[(TitleRegistry / Endpoint)] --> M1
    ETH --> M2
    ETH --> M3
    M1 --> SOL[(title_mirror)]
    M2 --> SOL
    M3 --> SOL
    SOL --> M4
    M4 --> ETH

    X[Unknown / admin MsgType] -.->|D7 D8| R[UnsupportedMsgType]
```

---

## 7. Relayer pipeline

```mermaid
flowchart TB
    subgraph IN["Input"]
        E1[Eth event] --> W1[watcher-eth]
        E2[Sol event] --> W2[watcher-sol]
    end

    W1 --> F{Finality?}
    W2 --> F
    F -->|No| WAIT[Wait for confirmations]
    WAIT --> F
    F -->|Yes| ST[store: seen]
    ST --> SG[signer secp256k1]
    SG --> Q{Quorum 2/3?}
    Q -->|No| EX[Signature exchange]
    EX --> Q
    Q -->|Yes| SU[submitter]
    SU --> CH{Destination chain?}
    CH -->|Eth| TX1[submitInbound]
    CH -->|Sol| TX2[apply_*]
    TX1 --> ID[store: delivered unique messageId]
    TX2 --> ID
    ID --> RC[reconciler I2 + states]
    RC --> API[GET /status /messages]
```

---

## 8. Security flowchart (CEI + anti-replay + pause)

```mermaid
flowchart TD
    A[Inbound with signatures] --> B[Checks: pause, MsgType, domain, quorum, flow]
    B --> C[Effects: messageId processed = true]
    C --> D[Interactions: dispatch to TitleRegistry / mint]
    D --> E{Reentry / re-submit?}
    E -->|Same messageId| F[MessageAlreadyProcessed]
    E -->|New signature old epoch| G[WrongDomain]
    E -->|OK new message| H[Process]

    I[Guardian pause] --> J[New inbound reverts]
    J --> K[Damage cap if quorum compromised]
```

---

## 9. Frontend — role walkthrough

```mermaid
flowchart TB
    HOME[/ /] --> EXP[/activos/assetId explorer]
    HOME --> CAR[/cartera Phantom]
    HOME --> OPE[/operador MetaMask]
    HOME --> VER[/verificador MetaMask]
    HOME --> PUE[/puente monitor]

    CAR --> C1[Sell / buy / refund]
    OPE --> O1[Issue / pause / court / D6]
    VER --> V1[Sign identity / certification]
    EXP --> E1[Recalculate ledger in browser]
    PUE --> P1[Messages + I2 green/red]

    C1 --> SIM[Simulate + decode before sign]
    O1 --> SIM
    V1 --> SIM
```

---

## 10. Path to both testnets (public acceptance)

```mermaid
flowchart TB
    LOCAL[Local stack green C10-C17] --> RT[REDTEAM closed]
    RT --> QA[QA closed]
    QA --> XA[EXTATK X1-X36 local zero broken]
    XA --> DEP[Deploy Sepolia + Devnet]
    DEP --> UI[Full cycle MetaMask + Phantom]
    UI --> ATK[Attacks P1 R5b P3 + X* subset]
    ATK --> DOC[DEPLOY-TESTNET-ES hashes both nets]
    DOC --> SOLV[SOLV]
    DOC -.->|One net missing| NO[v1 does NOT close]
```

---

## 11. Request states (I4)

```mermaid
stateDiagram-v2
    [*] --> Pending: escrow + TRANSFER_REQUEST
    Pending --> Completed: Approved + release
    Pending --> Refunded: Rejected / Expired / hardDeadline refund
    Pending --> Refunded: court cancels + payment refund
    Completed --> [*]
    Refunded --> [*]

    note right of Pending
      Never returns to Pending
      Never both Completed and Refunded
    end note
```

---

## Quick reading

| Document | Question it answers |
|----------|---------------------|
| This flowchart | In what order does the system run end to end? |
| [`diagrama-de-flujo-EN.md`](./diagrama-de-flujo-EN.md) | Which if/else decides each operation? |
| [`diagrama-de-clases-EN.md`](./diagrama-de-clases-EN.md) | Which pieces exist and how do they relate? |
| [`mapa-de-ataques-ES.md`](./mapa-de-ataques-ES.md) | Which attacks run and against what? |
| [`superficie-de-ataques-ES.md`](./superficie-de-ataques-ES.md) | What can be touched from outside? |
