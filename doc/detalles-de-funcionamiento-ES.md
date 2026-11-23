# Detalles de funcionamiento — Legal Title Bridge

> 🌐 **Español** · [English](./detalles-de-funcionamiento-EN.md)

**Idioma:** Español · Documento de orientación sobre estructura y flujos.  
**Alcance:** laboratorio Sepolia + Solana Devnet (no producción).  
**Regla de gobernanza:** Ethereum manda; el frontend no es verdad (D14); códec alineado en tres lenguajes (C5).

---

## 1. Visión general del monorepo

Puente Ethereum ↔ Solana para títulos legales. Las piezas principales:

| Carpeta | Rol |
|---------|-----|
| `src/` | Contratos Solidity (Foundry): registries, bridge, compliance, libraries |
| `test/` | Tests Foundry (unit, invariant, mocks, redteam, extatk) |
| `solana/` | Programa Anchor `title_mirror` + tests/scripts Devnet |
| `shared/` | Kit de protocolo: códec, redes, direcciones (Zod) |
| `relayer/` | Mensajero off-chain (Node.js): watchers, firma, entrega, API GET |
| `frontend/` | Next.js 16: activos, puente, cartera, operador, verificador |
| `e2e/` | Stack local Anvil+Solana + escenarios lifecycle/failures |
| `doc/` | Documentación en español (plan, protocolos, seguridad, QA) |
| `script/` / `scripts/` | Deploy Foundry vs utilidades bash/hooks/lint |
| `secrets/` | Keys de laboratorio (deploy, relayers, roles) |
| `lib/` | Dependencias Foundry (OpenZeppelin, forge-std) |
| `broadcast/` / `out/` / `cache/` | Artefactos generados de forge |

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

### Flujo entre piezas

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

`shared/` es el hub de datos (bytes, redes, direcciones). El relayer observa ambas cadenas y entrega mensajes. On-chain valida quorum y cambia estado.

---

## 2. Ethereum — `src/` por función

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

### Registries (raíz de `src/`)

| Archivo | Función |
|---------|---------|
| `TitleRegistry.sol` | Ciclo de vida del activo y DvP / transferencias en Ethereum |
| `IdentityRegistry.sol` | Identidad del holder (EIP-712, clave Solana como `bytes32`) |
| `AttestationRegistry.sol` | Certificaciones del activo (existencia + registral, quorum) |

- Interfaces: `interfaces/IIdentityRegistry.sol`, `IAttestationRegistry.sol`
- Errores: `errors/RegistryErrors.sol`
- `TitleRegistry` no tiene interfaz propia en `interfaces/`

### Bridge

| Archivo | Función |
|---------|---------|
| `BridgeEndpoint.sol` | Entrada con quorum (`submitInbound`), salida tipada (`emitOutbound`), pause, rotación de relayers |

- Interfaz: `interfaces/IBridgeEndpoint.sol`
- Errores: `errors/BridgeErrors.sol`
- Eventos clave: `OutboundEmitted(messageId, msgType, wire)`, `InboundProcessed(messageId, msgType)`

### Compliance (`src/compliance/`)

Módulos consultados por `TitleRegistry` antes de aprobar un transfer (`IComplianceModule`):

| Archivo | Regla |
|---------|--------|
| `CountryModule.sol` | País del comprador en allowlist |
| `LockupModule.sol` | Bloqueo temporal del holder |
| `MaxHoldersModule.sol` | Tope de holders con balance > 0 |

### Libraries (`src/libraries/`)

| Archivo | Función |
|---------|---------|
| `PacketCodec.sol` | Encode/decode del paquete cross-chain (C5) |
| `RelayerQuorum.sol` | Umbral y verificación ECDSA de relayers |
| `MessageIdSet.sol` | Idempotencia de `messageId` entrantes |
| `FlowLimiter.sol` | Caps de flujo por activo / transferencia |
| `LedgerChain.sol` | Cadena de hashes del ledger |

- Errores del códec: `errors/CodecErrors.sol`
- `Smoke.sol` es placeholder de toolchain (BOOT), no lógica de producto

---

## 3. Solana — `title_mirror` por función

En Solana no hay varios programas: todo vive en **`title_mirror`**. Identity/Attestation quedan en Ethereum.

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

| Cuenta PDA | Rol (análogo Eth) |
|------------|-------------------|
| `Config` | Endpoint remoto + relayers + pause + plazos |
| `Asset` | Espejo por `assetId` + mint Token-2022 |
| `ProcessedMessage` | Idempotencia de `messageId` |
| `Escrow` | DvP Pending → Completed / Refunded / CourtCancelled |

Seeds: `config`, `asset`, `processed`, `escrow`, `permanent_delegate`, `escrow_authority`, `extra-account-metas`.

### Bridge (`instructions/` + `quorum.rs`)

| Instrucción | Función |
|-------------|---------|
| `initialize_config` / `rotate_relayers` | Alta y rotación de relayers |
| `apply_issue` | Aplica ISSUE desde Eth (mint espejo) |
| `apply_decision` | Aplica decisión DvP |
| `apply_forced_transfer` | Transferencia forzada |
| `apply_forced_p7` | Forzada con escrow Pending (corte) |
| `request_transfer` / `refund_after_hard_deadline` | DvP local + refund unilateral (D5) |

Evento Solana relevante para Sol→Eth: `TransferRequested` en `request_transfer`.

### Compliance (`hook.rs` + `transfer_hook`)

No hay Country/Lockup/MaxHolders. La regla es **I5**: solo mueven el título el escrow o el permanent delegate.

| Pieza | Función |
|-------|---------|
| `hook.rs` | Clasifica autoridad (`TransferPath`) |
| `transfer_hook` | Entry Token-2022; rechaza paths no autorizados |
| feature `redteam` | Variante vulnerable a propósito |

### Libraries

| Módulo | Análogo Eth | Función |
|--------|-------------|---------|
| `codec.rs` | `PacketCodec.sol` | Wire LTB (debe matchear Eth + `shared/`) |
| `quorum.rs` | `RelayerQuorum.sol` | ⌈2n/3⌉ + secp256k1 vía sysvar Instructions |
| `dvp.rs` | helpers de plazos | Refund unilateral / reject post–hard deadline |
| `errors.rs` | `*Errors.sol` | `MirrorError` |

### Paralelo Eth ↔ Sol

| Función | Ethereum (`src/`) | Solana (`title_mirror`) |
|---------|-------------------|-------------------------|
| Registries | `Title` / `Identity` / `Attestation` | PDAs `Asset` + `Escrow` (identidad/attest solo en Eth) |
| Bridge | `BridgeEndpoint` | `apply_*` + `Config` + `quorum` |
| Compliance | `compliance/*` | `hook` / `transfer_hook` |
| Libraries | `libraries/*` | `codec` / `quorum` / `dvp` |

---

## 4. Shared y Relayer — el puente off-chain

**Matiz:** `shared/` no es el puente en runtime; es el **kit de protocolo**. El **mensajero** es `relayer/` (Node.js). Los endpoints on-chain siguen siendo `BridgeEndpoint` + `title_mirror`.

```mermaid
flowchart TB
  subgraph ONCHAIN["On-chain (verdad)"]
    ETH["Ethereum<br/>BridgeEndpoint + registries"]
    SOL["Solana<br/>title_mirror"]
  end

  subgraph SHARED["shared/ — lenguaje común"]
    COD["codec.ts<br/>Packet / MsgType / messageId / digest"]
    ADDR["addresses.ts<br/>direcciones por red"]
    NET["network.ts<br/>local | sepolia-devnet"]
    DEP["deployments/*.json"]
  end

  subgraph REL["relayer/ — mensajero off-chain"]
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
  SOL -->|"eventos finalized"| WS
  WE --> ST
  WS --> ST
  ST --> SG
  SG --> SU
  SU -->|"wire + firmas quorum"| ETH
  SU -->|"wire + firmas quorum"| SOL
  ST --> API
  RC --> API
  API -->|"solo lectura"| FE

  SHARED -.->|"mismo wire / ids"| ETH
  SHARED -.->|"mismo wire / ids"| SOL
  SHARED -.-> REL
  SHARED -.-> FE
```

### `shared/` — contenido

| Pieza | Contiene | Para qué |
|-------|----------|----------|
| `codec.ts` | `MsgType`, encode/decode, `messageId`, `signingDigest` | Mismos bytes que `PacketCodec.sol` y `codec.rs` |
| `addresses.ts` | Zod + direcciones Eth/Sol por red | D14: nadie saca direcciones de la URL |
| `network.ts` | `'local' \| 'sepolia-devnet'` | Identificador de entorno |
| `deployments/` | JSON post-deploy | Fuente de direcciones reales |
| `index.ts` | Re-exports | Import único |

No observa cadenas ni firma. Solo define el contrato de datos.

### `relayer/` — pipeline del mensaje

```mermaid
sequenceDiagram
  participant Src as Cadena origen
  participant W as Watcher
  participant Store as MessageStore
  participant Sign as Signer
  participant Sub as Submitter
  participant Dst as Cadena destino

  Src->>W: evento bridge (wire)
  W->>W: espera finality
  W->>Store: insert seen → finalized
  Sign->>Store: firma digest (secp256k1)
  Note over Store: firmas ≥ ⌈2n/3⌉ → quorum_ready
  Sub->>Dst: deliver(wire + signatures)
  Store->>Store: submitted → delivered
```

| Módulo | Rol |
|--------|-----|
| `watcher-eth.ts` | Lee outbound Eth; finality por confirmaciones o tag `finalized` |
| `watcher-sol.ts` | Lee eventos Sol; solo commitment `finalized` |
| `store.ts` | SQLite: `messageId` único, estados, retries exponenciales |
| `signer.ts` | Firma el `signingDigest` (sin prefijo EIP-191) |
| `submitter.ts` | Junta firmas; con quorum entrega a destino |
| `reconciler.ts` | I2 (supply Eth=Sol) y D6 (Approved vs Refunded) |
| `status-api.ts` | HTTP GET `/status` y `/messages` |
| `types.ts` | Direcciones `eth_to_sol` / `sol_to_eth` y estados |

Estados del mensaje: `seen → finalized → signed → quorum_ready → submitted → delivered` (o `failed`).

### Tipos de mensaje (`MsgType`, D8)

| MsgType | Dirección | Origen típico | Destino aplica |
|--------:|-----------|---------------|----------------|
| `ISSUE` (0) | Eth → Sol | Ethereum | `apply_issue` |
| `TRANSFER_REQUEST` (1) | Sol → Eth | Solana (DvP) | `BridgeEndpoint.submitInbound` |
| `TRANSFER_DECISION` (2) | Eth → Sol | Ethereum | `apply_decision` |
| `FORCED_TRANSFER` (3) | Eth → Sol | Ethereum | `apply_forced_*` |

En una frase:

- **`shared/`** = diccionario del puente (bytes, redes, direcciones).
- **`relayer/`** = cartero que ve un evento finalizado, lo guarda, lo firma en quorum y lo entrega.
- **On-chain** = quien valida quorum y cambia estado; el relayer no es autoridad.

---

## 5. Mapa ISSUE (Eth → Sol)

```mermaid
sequenceDiagram
  participant TR as TitleRegistry.sol
  participant BE as BridgeEndpoint.sol
  participant RPC_E as RPC Ethereum
  participant W as watcher-eth.ts
  participant ST as store.ts
  participant SG as signer.ts
  participant SU as submitter.ts
  participant RPC_S as RPC Solana
  participant TM as title_mirror apply_issue

  TR->>BE: emitOutbound(ISSUE, payload)
  BE->>BE: PacketCodec.encode → messageId
  BE-->>RPC_E: evento OutboundEmitted(messageId, msgType, wire)

  loop poll()
    W->>RPC_E: getOutboundEvents(from, head)
    RPC_E-->>W: logs OutboundEmitted
    W->>W: ¿finality? (confirmaciones o tag finalized)
  end

  W->>ST: insert finalized (eth_to_sol)
  SG->>ST: firmas digest (quorum ⌈2n/3⌉)
  SU->>RPC_S: deliver(wire + signatures)
  RPC_S->>TM: apply_issue(message_id, wire)
  TM->>TM: quorum + ProcessedMessage + mint
```

Archivos clave: `TitleRegistry` → `BridgeEndpoint.emitOutbound` → `watcher-eth` → `store` / `signer` / `submitter` → `apply_issue`.

---

## 6. Mapa DvP (REQUEST Sol→Eth, luego DECISION Eth→Sol)

```mermaid
sequenceDiagram
  participant User as Seller/Buyer
  participant TM as title_mirror
  participant RPC_S as RPC Solana
  participant WS as watcher-sol.ts
  participant ST as store / signer / submitter
  participant RPC_E as RPC Ethereum
  participant BE as BridgeEndpoint
  participant TR as TitleRegistry
  participant WE as watcher-eth.ts

  User->>TM: request_transfer(...)
  TM->>TM: escrow Pending + título/pago
  TM-->>RPC_S: evento TransferRequested
  Note over TM,ST: Relayer arma TRANSFER_REQUEST wire<br/>(codec shared) y lo firma

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

## 7. Cómo el relayer Node “recibe” eventos

El proceso **no recibe push** de la cadena. **Pide** a los RPC (poll): lee logs/eventos, espera finality, firma y **empuja** una tx a la otra cadena.

```mermaid
flowchart LR
  subgraph READ["Solo lectura RPC"]
    E["JSON-RPC Eth<br/>logs OutboundEmitted"]
    S["JSON-RPC Sol<br/>logs TransferRequested"]
  end

  subgraph NODE["relayer Node.js"]
    W1["WatcherEth"]
    W2["WatcherSol"]
    CORE["store → signer → submitter"]
  end

  subgraph WRITE["Escritura tx"]
    TO_SOL["tx apply_* en Solana"]
    TO_ETH["tx submitInbound en Eth"]
  end

  E --> W1 --> CORE
  S --> W2 --> CORE
  CORE --> TO_SOL
  CORE --> TO_ETH
```

### Eth → Sol (detalle)

1. En Eth, `TitleRegistry` (u otro con rol) llama `BridgeEndpoint.emitOutbound` → log **`OutboundEmitted(messageId, msgType, wire)`**.
2. `WatcherEth.poll()` usa un adaptador `EthBlockSource`:
   - `getBlockNumber` / `getFinalizedBlockNumber`
   - `getOutboundEvents(from, to)` → en la práctica `eth_getLogs` del `bridgeEndpoint` en `shared/addresses`
3. Solo si el bloque es final (`confirmations` o tag `finalized`) → `MessageStore`
4. Relayers firman el `signingDigest` (mismo códec en tres lenguajes)
5. Con quorum, `Submitter` envía tx en Solana: `apply_issue` / `apply_decision` / `apply_forced_*`
6. On-chain Solana revalida quorum (secp256k1 + sysvar Instructions) y aplica el efecto

**Modelo:** RPC Eth (leer) → Node → RPC Sol (escribir).

### Sol → Eth (detalle)

1. `request_transfer` emite **`TransferRequested`**; el wire `TRANSFER_REQUEST` se construye con el códec canónico
2. `WatcherSol.poll()` exige commitment **`finalized`** vía `SolEventSource.getEvents`
3. Dedup por `messageId` → store con dirección `sol_to_eth`
4. Firma + quorum
5. Entrega en Eth: **`BridgeEndpoint.submitInbound(wire, signatures)`** (permissionless; importa el quorum válido)
6. Eth marca `messageId` procesado y despacha al registry

**Modelo:** RPC Sol (leer) → Node → RPC Eth (escribir).

### Diseño de adaptadores

Los watchers **no embeben** un cliente RPC concreto; reciben interfaces inyectables:

- `EthBlockSource` / `SolEventSource` (lectura)
- `DeliveryTransport` (escritura)

En tests/e2e se inyectan fakes (`e2e/src/sim/relayer-fleet.ts`). En testnet el adaptador real habla con Sepolia / Devnet.

---

## 8. Referencias relacionadas

- Protocolo de mensajes (wire, digests): [`PROTOCOLO-ES.md`](./PROTOCOLO-ES.md)
- Planificación y decisiones D1–D14: [`planificacion-ES.md`](./planificacion-ES.md)
- Hitos: [`hitos-ES.md`](./hitos-ES.md)
- Deploy testnet: [`DEPLOY-TESTNET-ES.md`](./DEPLOY-TESTNET-ES.md)
- README del repo: [`../README-ES.md`](../README-ES.md)
