# Diagrama de clases — Legal Title Bridge (Ethereum ↔ Solana)

> 🌐 **Español** · [English](./diagrama-de-clases-EN.md)

**Idioma:** Español · Módulo 22 · **as-built** (SOLV 2026-11-23).  
**Stack:** Solidity `0.8.37` / EVM Cancun · Anchor `0.31.1` · Relayer + Frontend TypeScript.  
**Fuente:** [`planificacion-ES.md`](./planificacion-ES.md) §3–§8, D1–D14.

Vista estructural de contratos Ethereum, programa Solana, librerías, mensajes tipados, relayer y frontend. Los nombres de métodos son el diseño objetivo de v1; pueden refinarse en CODEC/TITLE sin cambiar las responsabilidades.

---

## 1. Panorama (componentes)

```mermaid
flowchart LR
  subgraph ETH["Ethereum — fuente de verdad D1"]
    TR[TitleRegistry]
    IR[IdentityRegistry]
    AR[AttestationRegistry]
    BE[BridgeEndpoint]
    TR --- IR
    TR --- AR
    TR --- BE
  end

  subgraph REL["Relayers 2-de-3"]
    R1[Relayer proceso]
    R1 --- SQ[(SQLite)]
    R1 --- API["status-api GET"]
  end

  subgraph SOL["Solana — representación"]
    TM[title_mirror]
    MINT[Token-2022 mint]
    HOOK[Transfer hook]
    ESC[Escrow DvP]
    TM --- MINT
    TM --- HOOK
    TM --- ESC
  end

  subgraph FE["Frontend Next.js"]
    UI[Vistas por rol]
    SH[shared/]
    UI --- SH
  end

  BE <-->|MsgType| R1
  R1 <-->|MsgType| TM
  UI -->|lee / arma txs| ETH
  UI -->|lee / arma txs| SOL
  UI -.->|informativo| API
```

---

## 2. Ethereum — clases principales

```mermaid
classDiagram
    direction TB

    class ITitleRegistry {
        <<interface>>
        +issue(assetId, amount, toHolder)
        +requestDecision(transferId)
        +decide(transferId, outcome)
        +forcedTransfer(assetId, from, to, amount, resolutionHash)
        +reconcile(transferId, resolutionHash)
        +redeemInKind(assetId, holder, amount)
        +balanceOf(assetId, holder) uint256
        +assetState(assetId) AssetState
        +entryHash(assetId, index) bytes32
    }

    class IIdentityRegistry {
        <<interface>>
        +isVerified(holder) bool
        +getAssertion(holder) Assertion
        +registerAssertion(holder, assertion, signature)
        +revoke(holder)
    }

    class IAttestationRegistry {
        <<interface>>
        +isCertified(assetId) bool
        +attest(assetId, kind, expiry, signature)
        +quorumMet(assetId) bool
    }

    class IBridgeEndpoint {
        <<interface>>
        +submitInbound(packet, signatures)
        +emitOutbound(msgType, payload) bytes32 messageId
        +processed(messageId) bool
        +pause()
        +unpause()
        +rotateRelayers(newSet, newThreshold, delay)
    }

    class IComplianceModule {
        <<interface>>
        +canTransfer(assetId, from, to, amount) bool
        +ruleId() uint8
    }

    class TitleRegistry {
        +mapping balances
        +mapping requests
        +mapping states
        +mapping entryHashes
        +issue(...)
        +onTransferRequest(...)
        +decide(...)
        +forcedTransfer(...)
        +reconcile(...)
        +_appendEntry(assetId, data) bytes32
    }

    class IdentityRegistry {
        +mapping assertions
        +verificador role
        +registerAssertion EIP712
        +isVerified(holder) bool
        +revoke(holder)
    }

    class AttestationRegistry {
        +mapping attestations
        +certifier roles
        +attest(...)
        +isCertified(assetId) bool
        +quorumMet(assetId) bool
    }

    class BridgeEndpoint {
        +relayerSet
        +epoch
        +threshold
        +MessageIdSet processed
        +FlowLimiter limits
        +submitInbound(...)
        +emitOutbound(...)
        +pause guardian
        +rotateRelayers timelock
        -_dispatch(msgType, payload)
    }

    class CountryModule {
        +canTransfer(...)
    }
    class MaxHoldersModule {
        +canTransfer(...)
    }
    class LockupModule {
        +canTransfer(...)
    }

    class Assertion {
        <<struct>>
        +bytes32 holder
        +uint16 country
        +uint8 investorType
        +uint64 expiry
    }

    class TransferRequest {
        <<struct>>
        +bytes32 transferId
        +bytes32 seller
        +bytes32 buyer
        +uint256 amount
        +uint64 deadline
        +RequestStatus status
    }

    class LegalTitleErrors {
        <<errors>>
        +NotVerified()
        +TransferNotCompliant()
        +CertificationExpired()
        +AssetFrozen()
        +UnknownMessage()
        +MessageAlreadyProcessed()
        +InvalidQuorum()
        +WrongDomain()
        +UnsupportedMsgType()
        +RequestNotPending()
        +DeadlinePassed()
        +FlowLimitExceeded()
        +ThresholdTooLow()
        +RoleOverlap()
        +EmptyCode()
        +ZeroAddress()
        +Unauthorized()
    }

    ITitleRegistry <|.. TitleRegistry
    IIdentityRegistry <|.. IdentityRegistry
    IAttestationRegistry <|.. AttestationRegistry
    IBridgeEndpoint <|.. BridgeEndpoint
    IComplianceModule <|.. CountryModule
    IComplianceModule <|.. MaxHoldersModule
    IComplianceModule <|.. LockupModule

    TitleRegistry --> IdentityRegistry : consulta
    TitleRegistry --> AttestationRegistry : consulta
    TitleRegistry --> IComplianceModule : reglas
    TitleRegistry --> BridgeEndpoint : emite / recibe
    TitleRegistry --> TransferRequest : estado
    IdentityRegistry --> Assertion : storage
    BridgeEndpoint ..> LegalTitleErrors : reverts
    TitleRegistry ..> LegalTitleErrors : reverts
```

---

## 3. Librerías Ethereum

```mermaid
classDiagram
    direction LR

    class PacketCodec {
        <<library>>
        +encode(packet) bytes
        +decode(data) Packet
        +messageId(packet) bytes32
        +digest(domain, packet) bytes32
    }

    class RelayerQuorum {
        <<library>>
        +verify(digest, signatures, set, threshold, epoch) bool
        +requireThreshold(n, threshold)
    }

    class MessageIdSet {
        <<library>>
        +contains(id) bool
        +add(id)
    }

    class FlowLimiter {
        <<library>>
        +checkAndConsume(assetId, amount, window) 
        +remaining(assetId) uint256
    }

    class LedgerChain {
        <<library>>
        +nextHash(prevHash, data) bytes32
        +verifyChain(hashes, genesis) bool
    }

    class Packet {
        <<struct>>
        +uint8 version
        +uint64 srcChain
        +uint64 dstChain
        +bytes32 emitter
        +uint64 epoch
        +uint8 msgType
        +bytes32 messageId
        +bytes payload
    }

    class Domain {
        <<struct>>
        +uint8 version
        +uint64 srcChain
        +uint64 dstChain
        +bytes32 emitter
        +uint64 epoch
    }

    class MsgType {
        <<enumeration>>
        ISSUE
        TRANSFER_REQUEST
        TRANSFER_DECISION
        FORCED_TRANSFER
    }

    PacketCodec --> Packet
    PacketCodec --> Domain
    PacketCodec --> MsgType
    RelayerQuorum --> Domain : digest ata época
    BridgeEndpoint_ref --> PacketCodec
    BridgeEndpoint_ref --> RelayerQuorum
    BridgeEndpoint_ref --> MessageIdSet
    BridgeEndpoint_ref --> FlowLimiter
    TitleRegistry_ref --> LedgerChain

    class BridgeEndpoint_ref {
        <<contract ref>>
        BridgeEndpoint
    }
    class TitleRegistry_ref {
        <<contract ref>>
        TitleRegistry
    }
```

---

## 4. Solana — programa `title_mirror`

```mermaid
classDiagram
    direction TB

    class TitleMirror {
        <<program>>
        +initialize_config(...)
        +rotate_relayers(...)
        +apply_issue(packet, sigs)
        +request_transfer(...)
        +apply_decision(...)
        +refund_after_hard_deadline(...)
        +apply_forced_transfer(...)
        +transfer_hook(...)
    }

    class Config {
        <<account>>
        +bump u8
        +eth_endpoint bytes32
        +epoch u64
        +threshold u8
        +relayers Vec~PubkeyEth~
        +paused bool
    }

    class Escrow {
        <<account PDA>>
        +transfer_id bytes32
        +seller Pubkey
        +buyer Pubkey
        +amount u64
        +payment_mint Pubkey
        +payment_amount u64
        +deadline i64
        +hard_deadline i64
        +status EscrowStatus
    }

    class Codec {
        <<module>>
        +encode / decode
        +message_id
        +digest
    }

    class Quorum {
        <<module>>
        +verify_secp256k1_ixs
        +require_sysvar_instructions
    }

    class Hook {
        <<module>>
        +extra_account_metas
        +reject_unauthorized_path
    }

    class EscrowStatus {
        <<enum>>
        Pending
        Completed
        Refunded
    }

    TitleMirror --> Config
    TitleMirror --> Escrow
    TitleMirror --> Codec
    TitleMirror --> Quorum
    TitleMirror --> Hook
    Escrow --> EscrowStatus
    TitleMirror ..> Token2022 : mint / transfer / permanent delegate
```

**Cuentas críticas a validar (Cashio/Wormhole lessons):** `Config` (seeds/owner), mint canónico, token accounts (`token::mint`, `token::authority`), escrow PDA, sysvar `Instructions` con `address = sysvar::instructions::ID`.

---

## 5. Relayer y paquete compartido

```mermaid
classDiagram
    direction TB

    class SharedPacket {
        <<shared/codec.ts>>
        +encode()
        +decode()
        +messageId()
        +digest()
    }

    class NetworkAddresses {
        <<shared/>>
        +ethereum endpoints
        +solana program ids
        +Zod schemas
    }

    class WatcherEth {
        +poll events
        +wait confirmations / finalized
    }
    class WatcherSol {
        +poll events
        +commitment finalized
    }
    class Signer {
        +secp256k1 key
        +sign digest
    }
    class Submitter {
        +collect quorum
        +submit inbound tx
    }
    class Store {
        +SQLite
        +unique messageId
        +idempotent retries
    }
    class Reconciler {
        +compare I2 supply
        +compare request statuses
        +flag D6 divergence
    }
    class StatusApi {
        +GET /status
        +GET /messages
        +reject non-GET
    }

    class RelayerProcess {
        WatcherEth
        WatcherSol
        Signer
        Submitter
        Store
        Reconciler
        StatusApi
    }

    RelayerProcess --> SharedPacket
    RelayerProcess --> NetworkAddresses
    WatcherEth --> Store
    WatcherSol --> Store
    Submitter --> Signer
    Submitter --> Store
    Reconciler --> Store
    StatusApi --> Store
```

---

## 6. Frontend (vistas y límites D14)

```mermaid
classDiagram
    direction LR

    class AppRouter {
        +/activos/assetId
        +/cartera
        +/operador
        +/verificador
        +/puente
    }

    class ChainReaders {
        <<lib>>
        +readTitleRegistry()
        +readIdentity()
        +readAttestations()
        +readSolanaBalances()
        +verifyLedgerChain()
    }

    class TxBuilders {
        <<lib>>
        +buildEthTx()
        +buildSolTx()
        +simulateBeforeSign()
        +decodeForConfirm()
    }

    class NetworkGuard {
        <<lib>>
        +assertChainId()
        +assertSolanaGenesis()
        +addressesFromSharedOnly()
    }

    class WalletEth {
        MetaMask EIP-1193
    }
    class WalletSol {
        Phantom adapter
    }

    AppRouter --> ChainReaders
    AppRouter --> TxBuilders
    AppRouter --> NetworkGuard
    TxBuilders --> WalletEth
    TxBuilders --> WalletSol
    ChainReaders --> NetworkAddresses
    NetworkGuard --> NetworkAddresses
```

---

## 7. Roles y quién toca qué (D13)

| Rol | Ethereum | Solana | Frontend |
|-----|----------|--------|----------|
| Emisor | `issue` (si certificaciones OK) | recibe mint vía `ISSUE` | `/operador` |
| Verificador | firmas EIP-712 identidad | — | `/verificador` |
| Certificador | firmas certificación | — | `/verificador` |
| Operador registro | estados, reglas | — | `/operador` |
| Ejecutor judicial | `forcedTransfer` + hash | efecto vía `FORCED_TRANSFER` | `/operador` |
| Guardián | `pause` / límites | pause local si aplica | `/operador` |
| Titular / comprador | identidad previa | escrow DvP | `/cartera` |
| Relayer | firma inbound/outbound | firma inbound/outbound | solo lectura en `/puente` |
| Público | lectura | lectura | `/activos`, `/puente` |

El deploy comprueba **`RoleOverlap`**: las claves de roles críticos no se solapan.

---

## 8. Relaciones con invariantes

| Clase / módulo | Invariantes que sostiene |
|----------------|--------------------------|
| `TitleRegistry` + `LedgerChain` | I1, I9 |
| `BridgeEndpoint` + `MessageIdSet` + `RelayerQuorum` | I3, I8 |
| `IdentityRegistry` + `AttestationRegistry` + compliance | I7 |
| `Escrow` + decisiones | I4, I6 |
| `Hook` + permanent delegate | I5 |
| `Reconciler` | I2 (y detección D6) |

---

## 9. Notas de lectura

- Este diagrama es **to-be**: no implica que los archivos existan aún.
- El códec debe ser **idéntico** en Solidity, Rust y TypeScript (fase CODEC / C5).
- Gobernanza (relayers, umbral, roles, código) **nunca** viaja en un `MsgType` (D7/D8).
- Actualizar este doc al cerrar TITLE, ENDPOINT, MIRROR y DVP si los nombres de API se estabilizan.
