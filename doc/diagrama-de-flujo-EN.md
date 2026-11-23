# Flowchart — Legal Title Bridge

> 🌐 **English** · [Español](./diagrama-de-flujo-ES.md)

**Language:** English · Module 22 · **as-built** (SOLV 2026-11-23).  
**Source:** [`planificacion-EN.md`](./planificacion-EN.md) D1–D6, MsgType, §8 invariants.  
**Companion:** [`flujograma-EN.md`](./flujograma-EN.md) (full lifecycle) · [`diagrama-de-clases-EN.md`](./diagrama-de-clases-EN.md).

Internal **decision flows** per operation. Each diamond is a point where the system can revert or branch.

---

## 1. Issuance (`ISSUE`) — Ethereum → Solana

```mermaid
flowchart TD
    A[Issuer: issue assetId, amount, toHolder] --> B{Roles OK?}
    B -->|No| Z1[Unauthorized]
    B -->|Yes| C{AttestationRegistry.isCertified?}
    C -->|No| Z2[CertificationExpired / no quorum]
    C -->|Yes| D{Identity toHolder valid?}
    D -->|No| Z3[NotVerified]
    D -->|Yes| E[Credit balance in TitleRegistry]
    E --> F[LedgerChain.append entry]
    F --> G[BridgeEndpoint.emitOutbound ISSUE]
    G --> H[Relayers: finality → sign → quorum]
    H --> I[title_mirror.apply_issue]
    I --> J{Quorum + domain + canonical mint?}
    J -->|No| Z4[InvalidQuorum / WrongDomain / constraint]
    J -->|Yes| K[Mint Token-2022 to issuer]
    K --> L{I2 supply Eth == Sol?}
    L -->|No| W[Reconciler alerts]
    L -->|Yes| OK([Issuance OK])
    Z1 --> End([Revert])
    Z2 --> End
    Z3 --> End
    Z4 --> End
```

---

## 2. Transfer request + escrow (Solana → Ethereum)

```mermaid
flowchart TD
    A[Seller: request_transfer] --> B{Will hook allow move to escrow?}
    B -->|Unauthorized path| Z1[Hook reject]
    B -->|Yes| C[Title token → escrow PDA]
    C --> D[Buyer: deposit payment]
    D --> E{payment mint == declared?}
    E -->|No| Z2[Constraint token::mint]
    E -->|Yes| F{Exact amounts?}
    F -->|No| Z3[Amount revert]
    F -->|Yes| G[Escrow status Pending]
    G --> H[Emit TRANSFER_REQUEST]
    H --> I[Relayers → BridgeEndpoint / TitleRegistry]
    I --> J[Register TransferRequest Pending]
    J --> OK([Await Ethereum decision])
    Z1 --> End([Revert])
    Z2 --> End
    Z3 --> End
```

---

## 3. Ethereum decision (D4) → Solana effect (D5/D6)

```mermaid
flowchart TD
    A[Operator/auto: decide transferId] --> B{Request Pending?}
    B -->|No| Z1[RequestNotPending]
    B -->|Yes| C{block.timestamp <= deadline?}
    C -->|No| D[Mark Expired]
    C -->|Yes| E{Buyer Identity valid?}
    E -->|No| F[Rejected NotVerified]
    E -->|Yes| G{Asset certification valid?}
    G -->|No| H[Rejected CertificationExpired]
    G -->|Yes| I{Compliance modules OK?}
    I -->|No| J[Rejected TransferNotCompliant]
    I -->|Yes| K{Asset Active not Frozen?}
    K -->|No| L[Rejected / AssetFrozen]
    K -->|Yes| M[Approved]
    D --> N[emit TRANSFER_DECISION Expired]
    F --> O[emit TRANSFER_DECISION Rejected]
    H --> O
    J --> O
    L --> O
    M --> P[emit TRANSFER_DECISION Approved]
    N --> Q[Relayers → Solana apply_decision]
    O --> Q
    P --> Q
    Q --> R{Arrived before hardDeadline?}
    R -->|Yes + Approved| S[Cross release: token→buyer, payment→seller]
    R -->|Yes + Rejected/Expired| T[Refund to original owners]
    R -->|No + late Approved| U[Solana REJECTS — D6]
    S --> V[Escrow Completed]
    T --> W[Escrow Refunded]
    U --> X[Reconciler detects divergence]
    X --> Y[Operator reconcile on Ethereum + hash]
    V --> OK([I4 unique terminal state])
    W --> OK
    Y --> OK2([Divergence corrected])
    Z1 --> End([Revert])
```

---

## 4. Unilateral refund after `hardDeadline` (D5)

```mermaid
flowchart TD
    A[refund_after_hard_deadline] --> B{Now >= hardDeadline?}
    B -->|No| Z1[TooEarly]
    B -->|Yes| C{Escrow still Pending?}
    C -->|No| Z2[Already terminal]
    C -->|Yes| D{Caller is seller or buyer or permissioned?}
    D -->|Third party tries to collect| Z3[Does not pay caller — P9]
    D -->|OK| E[Return token to seller]
    E --> F[Return payment to buyer]
    F --> G[Escrow Refunded]
    G --> H{Ethereum still Pending or Approved in flight?}
    H -->|Approved arrives later| I[Solana ignores — D6]
    H -->|Coherent Expired/Rejected| OK([I4/I6 OK])
    I --> J[Reconciler + reconcile Eth]
    Z1 --> End([Revert])
    Z2 --> End
    Z3 --> End
```

---

## 5. Inbound on `BridgeEndpoint` (quorum + domain + anti-replay)

```mermaid
flowchart TD
    A[submitInbound packet, signatures] --> B{paused?}
    B -->|Yes| Z1[Paused]
    B -->|No| C{msgType in enum?}
    C -->|No| Z2[UnsupportedMsgType]
    C -->|Yes| D{Domain: version, chains, emitter, epoch?}
    D -->|No| Z3[WrongDomain]
    D -->|Yes| E[digest = PacketCodec.digest]
    E --> F{RelayerQuorum.verify threshold?}
    F -->|No| Z4[InvalidQuorum]
    F -->|Yes| G{messageId already processed?}
    G -->|Yes| Z5[MessageAlreadyProcessed]
    G -->|No| H{FlowLimiter allows amount?}
    H -->|No| Z6[FlowLimitExceeded]
    H -->|Yes| I[MessageIdSet.add — CEI]
    I --> J[_dispatch fixed msgType]
    J --> K{Points at governance?}
    K -->|Yes impossible by enum| Z7[UnsupportedMsgType D7/D8]
    K -->|No| L[Effect on TitleRegistry / events]
    L --> OK([Processed once I3])
    Z1 --> End([Revert])
    Z2 --> End
    Z3 --> End
    Z4 --> End
    Z5 --> End
    Z6 --> End
    Z7 --> End
```

**Default state (D9 / Nomad):** an unknown `messageId` is **not** “approved”; it only passes after quorum + `add`.

---

## 6. Transfer hook on Solana (I5)

```mermaid
flowchart TD
    A[Any Token-2022 transfer] --> B[Hook CPI]
    B --> C{Source/destination is program escrow?}
    C -->|Yes| OK1([Allowed — request/release])
    C -->|No| D{Authority is permanent delegate PDA?}
    D -->|Yes + FORCED_TRANSFER path| OK2([Allowed — court order])
    D -->|No| E{Canonical mint / release path?}
    E -->|Yes| OK3([Allowed])
    E -->|No| Z[Reject — I5]
```

---

## 7. Court order (`FORCED_TRANSFER`)

```mermaid
flowchart TD
    A[Court executor: forcedTransfer + resolutionHash] --> B{Executor role?}
    B -->|No| Z1[Unauthorized]
    B -->|Yes| C{Pending escrow over those tokens?}
    C -->|Yes| D[Cancel request → refund payment to buyer]
    C -->|No| E[Continue]
    D --> E
    E --> F[Adjust TitleRegistry balances]
    F --> G[Append ledger entry with resolution hash]
    G --> H[emit FORCED_TRANSFER]
    H --> I[Solana: permanent delegate moves tokens]
    I --> J{I1 and I2 OK?}
    J -->|No| W[Reconciler alert]
    J -->|Yes| OK([Order applied])
    Z1 --> End([Revert])
```

---

## 8. Identity / certification verification (EIP-712)

```mermaid
flowchart TD
    A[Verifier signs Assertion off-chain] --> B[registerAssertion + signature]
    B --> C{EIP-712 domain = this contract + chainId?}
    C -->|No| Z1[InvalidSignature / WrongDomain]
    C -->|Yes| D{signer == VERIFIER_ROLE?}
    D -->|No| Z2[Unauthorized]
    D -->|Yes| E{expiry > now?}
    E -->|No| Z3[Already expired]
    E -->|Yes| F[Store assertion]
    F --> G[isVerified = true until expiry or revoke]

    H[Certifier signs attestation] --> I{Certifier quorum?}
    I -->|Insufficient for issue| J[issue blocked]
    I -->|Met| K[isCertified until expiry]
    Z1 --> End([Revert])
    Z2 --> End
    Z3 --> End
```

---

## 9. Relayer: from event to idempotent delivery

```mermaid
flowchart TD
    A[Watcher sees event] --> B{Confirmations / finalized?}
    B -->|No| W[Wait]
    B -->|Yes| C{messageId in Store?}
    C -->|Yes terminal| OK1([Idempotent skip])
    C -->|No or retryable| D[Sign digest]
    D --> E[Signature exchange among relayers]
    E --> F{Signatures >= threshold?}
    F -->|No| G[Wait for more signatures]
    F -->|Yes| H[Submitter sends destination tx]
    H --> I{Result?}
    I -->|OK| J[Store: delivered]
    I -->|AlreadyProcessed| J
    I -->|Temporary revert| K[Exponential backoff]
    K --> H
    J --> L[Reconciler compares I2 and states]
    L --> OK2([Done])
```

---

## 10. Frontend: builds tx without being source of truth (D14 / W2–W4)

```mermaid
flowchart TD
    A[User clicks action] --> B{chainId / genesis correct?}
    B -->|No| Z1[Buttons disabled + W2 warning]
    B -->|Yes| C[Builder uses addresses from shared/]
    C --> D{Query param endpoint/program?}
    D -->|Ignored W3| C
    D -->|N/A| E[Build calldata / instruction]
    E --> F[Simulate eth_call / simulateTransaction]
    F --> G[Confirm screen = decode of real tx]
    G --> H[Wallet shows typed data]
    H --> I[User signs]
    I --> J[Broadcast]
    J --> K[UI re-reads state from chains]
    K --> OK([OK])
    Z1 --> End([No signature])
```

---

## Deadline legend

| Clock | Who watches it | Effect |
|-------|----------------|--------|
| `deadline` | Ethereum when deciding (D4) | `Approved` only if `now <= deadline`; else → `Expired` |
| `hardDeadline = deadline + 7d` | Solana (D5/D6) | Unilateral refund only after; late `Approved` is rejected |

See also the timeline map in [`flujograma-EN.md`](./flujograma-EN.md).
