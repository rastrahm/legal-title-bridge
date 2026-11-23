# Diagrama de flujo — Legal Title Bridge

> 🌐 **Español** · [English](./diagrama-de-flujo-EN.md)

**Idioma:** Español · Módulo 22 · **as-built** (SOLV 2026-11-23).  
**Fuente:** [`planificacion-ES.md`](./planificacion-ES.md) D1–D6, MsgType, §8 invariantes.  
**Companion:** [`flujograma-ES.md`](./flujograma-ES.md) (ciclo de vida completo) · [`diagrama-de-clases-ES.md`](./diagrama-de-clases-ES.md).

Flujos de **decisión internos** por operación. Cada rombo es un punto donde el sistema puede revertir o ramificar.

---

## 1. Emisión (`ISSUE`) — Ethereum → Solana

```mermaid
flowchart TD
    A[Emisor: issue assetId, amount, toHolder] --> B{¿Roles OK?}
    B -->|No| Z1[Unauthorized]
    B -->|Sí| C{¿AttestationRegistry.isCertified?}
    C -->|No| Z2[CertificationExpired / no quorum]
    C -->|Sí| D{¿Identity toHolder vigente?}
    D -->|No| Z3[NotVerified]
    D -->|Sí| E[Acreditar saldo en TitleRegistry]
    E --> F[LedgerChain.append entry]
    F --> G[BridgeEndpoint.emitOutbound ISSUE]
    G --> H[Relayers: finality → firmar → quórum]
    H --> I[title_mirror.apply_issue]
    I --> J{¿Quórum + dominio + mint canónico?}
    J -->|No| Z4[InvalidQuorum / WrongDomain / constraint]
    J -->|Sí| K[Mint Token-2022 al emisor]
    K --> L{¿I2 supply Eth == Sol?}
    L -->|No| W[Reconciler alerta]
    L -->|Sí| OK([Emisión OK])
    Z1 --> End([Revert])
    Z2 --> End
    Z3 --> End
    Z4 --> End
```

---

## 2. Solicitud de transferencia + escrow (Solana → Ethereum)

```mermaid
flowchart TD
    A[Vendedor: request_transfer] --> B{¿Hook permitirá mover al escrow?}
    B -->|Camino no autorizado| Z1[Hook reject]
    B -->|Sí| C[Token título → escrow PDA]
    C --> D[Comprador: deposit payment]
    D --> E{¿payment mint == declarado?}
    E -->|No| Z2[Constraint token::mint]
    E -->|Sí| F{¿Montos exactos?}
    F -->|No| Z3[Revert monto]
    F -->|Sí| G[Escrow status Pending]
    G --> H[Emit TRANSFER_REQUEST]
    H --> I[Relayers → BridgeEndpoint / TitleRegistry]
    I --> J[Registrar TransferRequest Pending]
    J --> OK([Espera decisión Ethereum])
    Z1 --> End([Revert])
    Z2 --> End
    Z3 --> End
```

---

## 3. Decisión en Ethereum (D4) → efecto en Solana (D5/D6)

```mermaid
flowchart TD
    A[Operador/automático: decide transferId] --> B{¿Request Pending?}
    B -->|No| Z1[RequestNotPending]
    B -->|Sí| C{¿block.timestamp <= deadline?}
    C -->|No| D[Marcar Expired]
    C -->|Sí| E{¿Buyer Identity vigente?}
    E -->|No| F[Rejected NotVerified]
    E -->|Sí| G{¿Certificación activo vigente?}
    G -->|No| H[Rejected CertificationExpired]
    G -->|Sí| I{¿Compliance modules OK?}
    I -->|No| J[Rejected TransferNotCompliant]
    I -->|Sí| K{¿Asset Active not Frozen?}
    K -->|No| L[Rejected / AssetFrozen]
    K -->|Sí| M[Approved]
    D --> N[emit TRANSFER_DECISION Expired]
    F --> O[emit TRANSFER_DECISION Rejected]
    H --> O
    J --> O
    L --> O
    M --> P[emit TRANSFER_DECISION Approved]
    N --> Q[Relayers → Solana apply_decision]
    O --> Q
    P --> Q
    Q --> R{¿Llegó antes de hardDeadline?}
    R -->|Sí + Approved| S[Liberación cruzada: token→buyer, pago→seller]
    R -->|Sí + Rejected/Expired| T[Reembolso a dueños originales]
    R -->|No + Approved tardía| U[Solana RECHAZA — D6]
    S --> V[Escrow Completed]
    T --> W[Escrow Refunded]
    U --> X[Reconciler detecta divergencia]
    X --> Y[Operador reconcile en Ethereum + hash]
    V --> OK([I4 estado terminal único])
    W --> OK
    Y --> OK2([Divergencia corregida])
    Z1 --> End([Revert])
```

---

## 4. Reembolso unilateral tras `hardDeadline` (D5)

```mermaid
flowchart TD
    A[refund_after_hard_deadline] --> B{¿Ahora >= hardDeadline?}
    B -->|No| Z1[TooEarly]
    B -->|Sí| C{¿Escrow aún Pending?}
    C -->|No| Z2[Already terminal]
    C -->|Sí| D{¿Caller es seller o buyer o permissioned?}
    D -->|Tercero intenta cobrar| Z3[No paga al caller — P9]
    D -->|OK| E[Devolver token al seller]
    E --> F[Devolver pago al buyer]
    F --> G[Escrow Refunded]
    G --> H{¿Ethereum aún Pending o Approved en vuelo?}
    H -->|Approved llega después| I[Solana ignora — D6]
    H -->|Expired/Rejected coherente| OK([I4/I6 OK])
    I --> J[Reconciler + reconcile Eth]
    Z1 --> End([Revert])
    Z2 --> End
    Z3 --> End
```

---

## 5. Inbound en `BridgeEndpoint` (quórum + dominio + anti-replay)

```mermaid
flowchart TD
    A[submitInbound packet, signatures] --> B{¿paused?}
    B -->|Sí| Z1[Paused]
    B -->|No| C{¿msgType en enum?}
    C -->|No| Z2[UnsupportedMsgType]
    C -->|Sí| D{¿Domain: version, chains, emitter, epoch?}
    D -->|No| Z3[WrongDomain]
    D -->|Sí| E[digest = PacketCodec.digest]
    E --> F{¿RelayerQuorum.verify threshold?}
    F -->|No| Z4[InvalidQuorum]
    F -->|Sí| G{¿messageId ya processed?}
    G -->|Sí| Z5[MessageAlreadyProcessed]
    G -->|No| H{¿FlowLimiter permite amount?}
    H -->|No| Z6[FlowLimitExceeded]
    H -->|Sí| I[MessageIdSet.add — CEI]
    I --> J[_dispatch msgType fijo]
    J --> K{¿Apunta a gobernanza?}
    K -->|Sí imposible por enum| Z7[UnsupportedMsgType D7/D8]
    K -->|No| L[Efecto en TitleRegistry / eventos]
    L --> OK([Procesado una vez I3])
    Z1 --> End([Revert])
    Z2 --> End
    Z3 --> End
    Z4 --> End
    Z5 --> End
    Z6 --> End
    Z7 --> End
```

**Estado por defecto (D9 / Nomad):** un `messageId` desconocido **no** es “aprobado”; solo pasa tras quórum + `add`.

---

## 6. Transfer hook en Solana (I5)

```mermaid
flowchart TD
    A[Cualquier transfer Token-2022] --> B[Hook CPI]
    B --> C{¿Fuente/destino es escrow del programa?}
    C -->|Sí| OK1([Permitido — request/release])
    C -->|No| D{¿Authority es permanent delegate PDA?}
    D -->|Sí + FORCED_TRANSFER path| OK2([Permitido — orden judicial])
    D -->|No| E{¿Mint / release path canónico?}
    E -->|Sí| OK3([Permitido])
    E -->|No| Z[Reject — I5]
```

---

## 7. Orden judicial (`FORCED_TRANSFER`)

```mermaid
flowchart TD
    A[Ejecutor judicial: forcedTransfer + resolutionHash] --> B{¿Rol ejecutor?}
    B -->|No| Z1[Unauthorized]
    B -->|Sí| C{¿Hay escrow Pending sobre esos tokens?}
    C -->|Sí| D[Cancelar solicitud → reembolso pago al buyer]
    C -->|No| E[Continuar]
    D --> E
    E --> F[Ajustar saldos TitleRegistry]
    F --> G[Append ledger entry con hash resolución]
    G --> H[emit FORCED_TRANSFER]
    H --> I[Solana: permanent delegate mueve tokens]
    I --> J{¿I1 e I2 OK?}
    J -->|No| W[Alerta reconciler]
    J -->|Sí| OK([Orden aplicada])
    Z1 --> End([Revert])
```

---

## 8. Verificación de identidad / certificación (EIP-712)

```mermaid
flowchart TD
    A[Verificador firma Assertion off-chain] --> B[registerAssertion + signature]
    B --> C{¿EIP-712 domain = este contrato + chainId?}
    C -->|No| Z1[InvalidSignature / WrongDomain]
    C -->|Sí| D{¿signer == VERIFIER_ROLE?}
    D -->|No| Z2[Unauthorized]
    D -->|Sí| E{¿expiry > now?}
    E -->|No| Z3[Already expired]
    E -->|Sí| F[Store assertion]
    F --> G[isVerified = true hasta expiry o revoke]

    H[Certificador firma attestation] --> I{¿Quórum de certificadores?}
    I -->|Insuficiente para issue| J[issue bloqueado]
    I -->|Met| K[isCertified hasta expiry]
    Z1 --> End([Revert])
    Z2 --> End
    Z3 --> End
```

---

## 9. Relayer: de evento a entrega idempotente

```mermaid
flowchart TD
    A[Watcher ve evento] --> B{¿Confirmaciones / finalized?}
    B -->|No| W[Esperar]
    B -->|Sí| C{¿messageId en Store?}
    C -->|Sí terminal| OK1([Idempotent skip])
    C -->|No o retryable| D[Firmar digest]
    D --> E[Intercambio de firmas entre relayers]
    E --> F{¿Firmas >= threshold?}
    F -->|No| G[Esperar más firmas]
    F -->|Sí| H[Submitter envía tx destino]
    H --> I{¿Resultado?}
    I -->|OK| J[Store: delivered]
    I -->|AlreadyProcessed| J
    I -->|Revert temporal| K[Backoff exponencial]
    K --> H
    J --> L[Reconciler compara I2 y estados]
    L --> OK2([Fin])
```

---

## 10. Frontend: arma tx sin ser fuente de verdad (D14 / W2–W4)

```mermaid
flowchart TD
    A[Usuario pulsa acción] --> B{¿chainId / genesis correctos?}
    B -->|No| Z1[Botones disabled + aviso W2]
    B -->|Sí| C[Builder usa direcciones de shared/]
    C --> D{¿Query param endpoint/program?}
    D -->|Ignorado W3| C
    D -->|N/A| E[Construir calldata / instrucción]
    E --> F[Simular eth_call / simulateTransaction]
    F --> G[Pantalla de confirmación = decode de la tx real]
    G --> H[Billetera muestra datos tipados]
    H --> I[Usuario firma]
    I --> J[Broadcast]
    J --> K[UI relee estado desde cadenas]
    K --> OK([OK])
    Z1 --> End([Sin firma])
```

---

## Leyenda de plazos

| Reloj | Quién lo mira | Efecto |
|-------|---------------|--------|
| `deadline` | Ethereum al decidir (D4) | Solo `Approved` si `now <= deadline`; si no → `Expired` |
| `hardDeadline = deadline + 7d` | Solana (D5/D6) | Reembolso unilateral solo después; `Approved` tardío se rechaza |

Ver también el mapa temporal en [`flujograma-ES.md`](./flujograma-ES.md).
