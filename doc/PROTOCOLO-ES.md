# Protocolo de mensajes — Legal Title Bridge v1

> 🌐 [English](./PROTOCOLO-EN.md) · **Español**

**Idioma:** Español · Fase CODEC.  
**Implementaciones:** `PacketCodec.sol`, `solana/.../codec.rs`, `shared/src/codec.ts`.  
**Regla C5:** los tres lenguajes producen los **mismos bytes** y el **mismo** `messageId` / `signingDigest` para cada vector en `test/vectors/packets.json`.

Comentarios en código: inglés (o bilingüe). Este documento de producto queda en español.

---

## 1. Constantes

| Nombre | Valor | Notas |
|--------|-------|-------|
| `PACKET_VERSION` | `1` | Único admitido en v1 |
| `HEADER_SIZE` | `62` | Bytes fijos antes del payload |
| `DOMAIN_TAG` | `keccak256("LegalTitleBridge.Packet.v1")` | Prefijo del digest de firma (D11) |

### Identificadores de cadena (`uint64`)

| ID | Red |
|----|-----|
| `31337` | Ethereum local (anvil) |
| `11155111` | Ethereum Sepolia |
| `100001` | Solana local (test-validator) |
| `100002` | Solana Devnet |

---

## 2. `MsgType` (enum cerrado, D8)

| Valor | Nombre | Sentido |
|------:|--------|---------|
| `0` | `ISSUE` | Ethereum → Solana |
| `1` | `TRANSFER_REQUEST` | Solana → Ethereum |
| `2` | `TRANSFER_DECISION` | Ethereum → Solana |
| `3` | `FORCED_TRANSFER` | Ethereum → Solana |

Cualquier otro valor → `UnsupportedMsgType` en el endpoint (fases posteriores).

---

## 3. Layout wire (big-endian)

Todo entero multi-byte va en **big-endian**. Sin padding ABI entre campos del header.

| Offset | Tamaño | Campo | Tipo |
|-------:|-------:|-------|------|
| 0 | 1 | `version` | `uint8` |
| 1 | 8 | `srcChain` | `uint64` |
| 9 | 8 | `dstChain` | `uint64` |
| 17 | 32 | `emitter` | `bytes32` |
| 49 | 8 | `epoch` | `uint64` |
| 57 | 1 | `msgType` | `uint8` |
| 58 | 4 | `payloadLen` | `uint32` |
| 62 | N | `payload` | `bytes` |

`N = payloadLen`. Longitud total del paquete = `62 + N`.

Decode debe revertir si:

- `data.length < 62`
- `version != 1`
- `data.length != 62 + payloadLen`

---

## 4. Identificadores derivados

### `messageId`

```
messageId = keccak256(wire_bytes)
```

Hash de **todo** el paquete canónico (header + payload). Un cambio de un byte ⇒ otro id (P1/P2).

### `signingDigest` (relayers, D11)

```
DOMAIN_TAG = keccak256("LegalTitleBridge.Packet.v1")
signingDigest = keccak256(
  DOMAIN_TAG || version || srcChain || dstChain || emitter || epoch || messageId
)
```

Concatenación packed big-endian (misma regla que el header para enteros):

| Campo | Tamaño |
|-------|-------:|
| `DOMAIN_TAG` | 32 |
| `version` | 1 |
| `srcChain` | 8 |
| `dstChain` | 8 |
| `emitter` | 32 |
| `epoch` | 8 |
| `messageId` | 32 |
| **Total** | **121** |

El digest **no** incluye el payload crudo: el `messageId` ya lo ata. Incluye época y emisor para bloquear replays cross-deploy / cross-set (D11).

---

## 5. Payloads tipados (contenido de `payload`)

Codec de capa 1 trata el payload como opaco. Layouts v1 (también big-endian / fixed):

### `ISSUE` (0)

| Offset | Tamaño | Campo |
|-------:|-------:|-------|
| 0 | 32 | `assetId` |
| 32 | 32 | `amount` (`uint256`) |
| 64 | 32 | `toHolder` (pubkey Solana / `bytes32`) |
| **Total** | **96** | |

### `TRANSFER_REQUEST` (1)

| Offset | Tamaño | Campo |
|-------:|-------:|-------|
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

| Offset | Tamaño | Campo |
|-------:|-------:|-------|
| 0 | 32 | `transferId` |
| 32 | 1 | `outcome` (`0` Approved, `1` Rejected, `2` Expired) |
| 33 | 1 | `reasonCode` (0 si Approved/Expired) |
| 34 | 32 | `amount` |
| **Total** | **66** | |

### `FORCED_TRANSFER` (3)

| Offset | Tamaño | Campo |
|-------:|-------:|-------|
| 0 | 32 | `assetId` |
| 32 | 32 | `from` |
| 64 | 32 | `to` |
| 96 | 32 | `amount` |
| 128 | 32 | `resolutionHash` |
| **Total** | **160** | |

- `to == bytes32(0)`: rescate en especie → Solana **quema** (`apply_forced_transfer` burn path).
- Si el título está en escrow `Pending`, Solana usa `apply_forced_p7` (P7: pago al comprador, título al destinatario judicial).

---

## 6. Plazos (referencia D4–D6)

| Reloj | Quién | Efecto |
|-------|-------|--------|
| `deadline` | Ethereum al decidir | Solo `Approved` si `now <= deadline` |
| `hardDeadline = deadline + hard_deadline_secs` | Solana | Refund unilateral solo después; `Approved` tardío se rechaza (D6). Producción: `hard_deadline_secs = 7 días`. |

Detalle de estados de escrow: ver flujograma / fases DVP.

### 6.1 Carrera reembolso vs aprobación tardía (P4 / D6)

Escenario documentado (riesgo residual **aceptado**):

1. Escrow Solana en `Pending`; `now >= hardDeadline`.
2. Un caller cualquiera ejecuta `refund_after_hard_deadline` → Solana pasa a `Refunded` (pago al comprador, título al vendedor; el caller no recibe fondos — P9).
3. Los relayers entregan después un `TRANSFER_DECISION(Approved)` firmado en Ethereum (D4 cumplió a tiempo en Eth, pero la entrega fue lenta).
4. `apply_decision` en Solana **revierte** con `LateApprovalRejected` (o `EscrowNotPending` si el refund ya cerró).
5. Cada cadena tiene un estado terminal propio: Eth `Approved`, Solana `Refunded`. El reconciliador (fase COURT/RELAY) detecta la divergencia; el operador aplica `reconcile` en Ethereum con hash de resolución (D6).

No hay ventana en la que Solana complete y reembolse a la vez (I4).

---

## 7. Vectores dorados

Archivo: `test/vectors/packets.json`.

Cada entrada incluye al menos:

- `name`
- `packet` (campos tipados + `payload` hex)
- `wire` (hex del encoding canónico)
- `messageId` (hex 32 bytes)
- `signingDigest` (hex 32 bytes)

Generación: `forge test --match-test test_WriteGoldenVectors -vv`  
(escribe `test/vectors/packets.json`; el wrapper `script/GenVectors.s.sol` documenta el comando).

Verificación C5: tests Solidity + `cargo test -p title_mirror codec` + `npm run test:codec` en `shared/`.

---

## 8. Fuera de este protocolo

- Gobernanza (relayers, roles, código) **no** viaja en `MsgType` (D7).
- El frontend no redefine el layout: consume `shared/`.
