# Auditoría estática (C4) — justificaciones

**Herramientas:** Slither 0.11.6 (`slither . --exclude-dependencies --filter-paths 'lib/|test/'`), Aderyn 0.6.8 (`aderyn .`), `cargo audit` (workspace `solana/`), `npm audit --omit=dev` en `shared` / `relayer` / `frontend`.

**Fecha:** 2026-11-20 · fase REDTEAM · rama `redteam`

## Resumen

| Fuente | High | Medium | Acción |
|--------|------|--------|--------|
| Slither | 1 | 4 | Justificados abajo (falsos positivos / diseño) |
| Aderyn | 3 | — (Low aparte) | Justificados abajo |
| cargo audit (`solana/`) | 0 vulns | 3 warnings (unmaintained/unsound transitivas: bincode, libsecp256k1, rand) | Aceptadas: vienen del stack Anchor/Solana 0.31 / Agave; sin fix aguas arriba en v1 lab |
| npm audit | 0 | 0 | Sin vulnerabilidades en producción |

## Slither

### High — `uninitialized-state` en `TitleRegistry._entryHashes`

**Veredicto:** falso positivo. Es un `mapping` de arrays dinámicos; el almacenamiento por defecto es vacío y se rellena solo vía `_appendEntry`. No requiere inicialización en el constructor.

### Medium — `uninitialized-local` en `RelayerQuorum.verify` (`valid`)

**Veredicto:** aceptable. `uint256 valid` se incrementa solo en el bucle; el valor inicial 0 es el conteo correcto.

### Medium — `unused-return` en `forcedTransfer` / `redeemInKind` / `decide` → `emitOutbound`

**Veredicto:** diseño. El `messageId` de salida se emite en el evento `OutboundEmitted`; el caller on-chain no necesita el retorno. El relayer indexa logs, no el valor de retorno.

## Aderyn

### H-1 — Reentrancy: state change after external call

**Veredicto:** falso positivo / CEI correcto en `decide` y caminos de registro. El estado de la solicitud (`Approved` / `Rejected` / `Expired`) se escribe **antes** de `bridgeEndpoint.emitOutbound`. `emitOutbound` no hace callbacks a `TitleRegistry`. El control positivo P5 (`VulnerableTitleDecide`) demuestra el anti-patrón y el patrón seguro CEI.

### H-2 — Storage array edited with memory

**Veredicto:** aceptable. En `proposeRotateRelayers` se copia el calldata a `memory` y luego a storage en `PendingRotation`; no se edita storage a través de un alias de memory incorrecto.

### H-3 — Weak randomness

**Veredicto:** falso positivo. El protocolo no usa aleatoriedad on-chain para seguridad; no hay `block.prevrandao` / `timestamp` como fuente de entropía de privilegios.

## Low / informativos

Centralización (roles admin/guardian/operator/court), bucles de compliance y literales: aceptados en v1 de laboratorio (D7 gobernanza local, n pequeño). No bloquean C4.

## Criterio C4

Cero hallazgos High/Medium **sin justificar**. Este documento es la justificación exigida por el plan.
