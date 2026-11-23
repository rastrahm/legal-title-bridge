# Flujograma — Legal Title Bridge

> 🌐 **Español** · [English](./flujograma-EN.md)

**Idioma:** Español · Módulo 22 · **as-built** (TESTNET cerrada · SOLV en curso).  
**Fuente:** [`planificacion-ES.md`](./planificacion-ES.md) §6, §11–§12, D1–D6.  
**Companion:** [`diagrama-de-flujo-ES.md`](./diagrama-de-flujo-ES.md) (decisiones por operación).

Flujogramas **operativos** de punta a punta: fases del proyecto, ciclo de vida del activo, puente, plazos y cierre en ambas testnets.

---

## 1. Flujograma maestro del módulo (fases)

```mermaid
flowchart TB
    BOOT[BOOT scaffold] --> CODEC[CODEC vectores dorados]
    CODEC --> TITLE[TITLE registro + identidad]
    TITLE --> ATTEST[ATTEST certificaciones]
    ATTEST --> ENDPOINT[ENDPOINT puente Eth]
    ENDPOINT --> MIRROR[MIRROR programa Solana]
    MIRROR --> DVP[DVP escrow + plazos]
    DVP --> COURT[COURT orden + D6]
    COURT --> RELAY[RELAY 3 procesos]
    RELAY --> E2E[E2E stack local]
    E2E --> FRONT[FRONT Next.js]
    FRONT --> REDTEAM[REDTEAM R/P/W/M]
    REDTEAM --> QA[QA agente humano]
    QA --> EXTATK[EXTATK X1-X36 otro agente]
    EXTATK --> TESTNET[TESTNET Sepolia + Devnet]
    TESTNET --> SOLV[SOLV cierre v1]

    BOOT -.->|Autorizo Fase| GATE{{Gate obligatorio}}
    GATE -.-> CODEC
```

Cada flecha exige: *"Autorizo Fase \<ID\>"* + criterio de salida. Tablero: [`hitos-ES.md`](./hitos-ES.md).

---

## 2. Ciclo de vida del activo (vino en depósito fiscal)

```mermaid
flowchart TB
    subgraph PRE["Preparación"]
        P1[Alta identidad comprador/vendedor] --> P2[Certificaciones existencia + registral]
        P2 --> P3{¿Quórum certificadores?}
        P3 -->|No| P0[Emisión bloqueada]
        P3 -->|Sí| P4[Activo listo]
    end

    subgraph EMISION["Emisión"]
        E1[issue en TitleRegistry] --> E2[ISSUE → Solana mint]
        E2 --> E3[I2 supply alineado]
    end

    subgraph TRADE["Transferencia DvP"]
        T1[Vendedor: token → escrow] --> T2[Comprador: pago → escrow]
        T2 --> T3[TRANSFER_REQUEST → Eth]
        T3 --> T4{Decisión Eth}
        T4 -->|Approved| T5[Liberación cruzada Solana]
        T4 -->|Rejected| T6[Reembolso]
        T4 -->|Expired| T6
        T5 --> T7[Completed]
        T6 --> T8[Refunded]
    end

    subgraph COURT["Excepciones"]
        C1[Orden judicial FORCED_TRANSFER]
        C2[Reconciliación D6]
        C3[Rescate en especie]
    end

    P4 --> E1
    E3 --> T1
    T7 --> END1([Titularidad actualizada en Eth + Sol])
    T8 --> END2([Estado terminal sin doble cobro])
    E3 --> C1
    T3 --> C1
    T4 --> C2
    E3 --> C3
```

---

## 3. Camino feliz — entrega contra pago

```mermaid
sequenceDiagram
    autonumber
    actor V as Vendedor Phantom
    actor C as Comprador Phantom
    participant Sol as title_mirror
    participant Rel as Relayers 2/3
    participant Eth as TitleRegistry + Endpoint
    actor Op as Operador MetaMask

    V->>Sol: request_transfer (token → escrow)
    C->>Sol: deposit payment → escrow
    Sol->>Rel: evento TRANSFER_REQUEST
    Rel->>Eth: submitInbound TRANSFER_REQUEST
    Eth->>Eth: Request Pending
    Op->>Eth: decide Approved (antes deadline)
    Eth->>Rel: evento TRANSFER_DECISION
    Rel->>Sol: apply_decision Approved
    Sol->>V: pago liberado
    Sol->>C: token liberado
    Note over Eth,Sol: I4 Completed · I2 OK · I6 pago conservado
```

---

## 4. Camino de rechazo / vencimiento / D6

```mermaid
sequenceDiagram
    autonumber
    participant Sol as title_mirror
    participant Rel as Relayers
    participant Eth as Ethereum
    participant Rec as Reconciler
    actor Op as Operador

    Note over Eth: Caso A — Rejected/Expired a tiempo
    Eth->>Rel: TRANSFER_DECISION Rejected/Expired
    Rel->>Sol: apply_decision
    Sol->>Sol: Refunded (antes hardDeadline)

    Note over Sol,Eth: Caso B — Relayers apagados más allá de hardDeadline
    Sol->>Sol: refund_after_hard_deadline
    Eth-->>Rel: Approved tardío
    Rel->>Sol: apply_decision Approved
    Sol-->>Sol: RECHAZA (D6)
    Rec->>Rec: detecta divergencia I2/estado
    Rec->>Op: alerta
    Op->>Eth: reconcile + resolutionHash
    Note over Eth,Sol: Procedimiento probado en E2E F4
```

---

## 5. Línea de tiempo de plazos (D4–D6)

```mermaid
flowchart LR
    subgraph T["Tiempo →"]
        T0[request + deadline fijado]
        T1[deadline Eth]
        T2[hardDeadline = deadline + 7d]
        T3[después]
    end

    T0 --> T1 --> T2 --> T3

    T0 -.-> A["Eth puede Approved / Rejected"]
    T1 -.-> B["Eth solo Expired — no Approved"]
    T0 -.-> C["Solana: solo refund con decisión firmada"]
    T2 -.-> D["Solana: refund unilateral permitido"]
    T3 -.-> E["Approved que llega ya: rechazado · D6"]
```

---

## 6. Mensajería entre cadenas (enum cerrado)

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

    X[MsgType desconocido / admin] -.->|D7 D8| R[UnsupportedMsgType]
```

---

## 7. Pipeline del relayer

```mermaid
flowchart TB
    subgraph IN["Entrada"]
        E1[Evento Eth] --> W1[watcher-eth]
        E2[Evento Sol] --> W2[watcher-sol]
    end

    W1 --> F{¿Finality?}
    W2 --> F
    F -->|No| WAIT[Esperar confirmaciones]
    WAIT --> F
    F -->|Sí| ST[store: seen]
    ST --> SG[signer secp256k1]
    SG --> Q{¿Quórum 2/3?}
    Q -->|No| EX[Intercambio firmas]
    EX --> Q
    Q -->|Sí| SU[submitter]
    SU --> CH{¿Cadena destino?}
    CH -->|Eth| TX1[submitInbound]
    CH -->|Sol| TX2[apply_*]
    TX1 --> ID[store: delivered unique messageId]
    TX2 --> ID
    ID --> RC[reconciler I2 + estados]
    RC --> API[GET /status /messages]
```

---

## 8. Flujograma de seguridad (CEI + anti-replay + pausa)

```mermaid
flowchart TD
    A[Inbound con firmas] --> B[Checks: pause, MsgType, domain, quorum, flow]
    B --> C[Effects: messageId processed = true]
    C --> D[Interactions: dispatch a TitleRegistry / mint]
    D --> E{¿Reentrada / re-submit?}
    E -->|Mismo messageId| F[MessageAlreadyProcessed]
    E -->|Nueva firma época vieja| G[WrongDomain]
    E -->|OK nuevo mensaje| H[Procesar]

    I[Guardián pause] --> J[Nuevos inbound revert]
    J --> K[Límite de daño si quórum caído]
```

---

## 9. Frontend — recorrido por roles

```mermaid
flowchart TB
    HOME[/ /] --> EXP[/activos/assetId explorador]
    HOME --> CAR[/cartera Phantom]
    HOME --> OPE[/operador MetaMask]
    HOME --> VER[/verificador MetaMask]
    HOME --> PUE[/puente monitor]

    CAR --> C1[Vender / comprar / refund]
    OPE --> O1[Emitir / pausa / judicial / D6]
    VER --> V1[Firmar identidad / certificación]
    EXP --> E1[Recalcular ledger en browser]
    PUE --> P1[Mensajes + I2 verde/rojo]

    C1 --> SIM[Simular + decode antes de firmar]
    O1 --> SIM
    V1 --> SIM
```

---

## 10. Camino a ambas testnets (aceptación pública)

```mermaid
flowchart TB
    LOCAL[Stack local verde C10-C17] --> RT[REDTEAM cerrado]
    RT --> QA[QA cerrado]
    QA --> XA[EXTATK X1-X36 local cero roto]
    XA --> DEP[Deploy Sepolia + Devnet]
    DEP --> UI[Ciclo completo MetaMask + Phantom]
    UI --> ATK[Ataques P1 R5b P3 + subconjunto X*]
    ATK --> DOC[DEPLOY-TESTNET-ES hashes ambas redes]
    DOC --> SOLV[SOLV]
    DOC -.->|Falta una red| NO[v1 NO cierra]
```

---

## 11. Estados de una solicitud (I4)

```mermaid
stateDiagram-v2
    [*] --> Pending: escrow + TRANSFER_REQUEST
    Pending --> Completed: Approved + liberación
    Pending --> Refunded: Rejected / Expired / hardDeadline refund
    Pending --> Refunded: orden judicial cancela + refund pago
    Completed --> [*]
    Refunded --> [*]

    note right of Pending
      Nunca vuelve a Pending
      Nunca Completed y Refunded
    end note
```

---

## Lectura rápida

| Documento | Pregunta que responde |
|-----------|----------------------|
| Este flujograma | ¿En qué orden ocurre el sistema de punta a punta? |
| [`diagrama-de-flujo-ES.md`](./diagrama-de-flujo-ES.md) | ¿Qué if/else decide cada operación? |
| [`diagrama-de-clases-ES.md`](./diagrama-de-clases-ES.md) | ¿Qué piezas existen y cómo se relacionan? |
| [`mapa-de-ataques-ES.md`](./mapa-de-ataques-ES.md) | ¿Qué ataques se ejecutan y contra qué? |
| [`superficie-de-ataques-ES.md`](./superficie-de-ataques-ES.md) | ¿Qué se puede tocar desde fuera? |
