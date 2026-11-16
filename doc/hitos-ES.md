# Hitos — Módulo 22: Legal Title Bridge

**Uso:** marcar `[x]` al cerrar cada ítem. No sustituye la autorización de fase (`Autorizo Fase <ID>` en `planificacion-ES.md`).
**Destino v1:** evidencia en **Sepolia** y **Solana Devnet** (ambas).
**Orden cerrado tras FRONT:** REDTEAM → QA → EXTATK → TESTNET → SOLV.
**EXTATK:** X1–X36 fijos en local; subconjunto obligatorio en testnet.
**Última actualización:** 2026-11-16

---

## Cómo marcar

| Símbolo | Significado |
|---------|-------------|
| `[ ]` | Pendiente |
| `[x]` | Hecho (criterio de salida de la fase cumplido) |
| Autorización | Solo tras *"Autorizo Fase \<ID\>"* |
| Informe | Enlace o nota al cerrar (hash, PR, ruta de doc) |

---

## Acuerdos de planificación (cerrados)

- [x] Destino: Sepolia + Solana Devnet (ambas obligatorias)
- [x] Orden post-FRONT: REDTEAM → QA → EXTATK → TESTNET → SOLV
- [x] EXTATK en testnet = subconjunto (no repetir X1–X36 enteros)
- [x] Catálogo X1–X36 fijo para v1 (nada opcional por defecto)
- [x] Solidity del módulo: `0.8.37` exacto (EVM Cancun); Solana sin cambio (Anchor 0.31.1 / CLI 2.2.20)
- [x] Docs de diseño: clases, flujo, flujograma, mapa de ataques, superficie de ataques (ES)
- [ ] Decisiones D1–D14 revisadas y aceptadas (sobre todo D5/D6)
- [ ] Primera fase autorizada: *"Autorizo Fase BOOT"*

---

## Tablero rápido

| # | Fase | Autorizada | Cerrada | Evidencia / nota |
|---|------|:----------:|:------:|------------------|
| 1 | BOOT | ⬜ | ⬜ | |
| 2 | CODEC | ⬜ | ⬜ | |
| 3 | TITLE | ⬜ | ⬜ | |
| 4 | ATTEST | ⬜ | ⬜ | |
| 5 | ENDPOINT | ⬜ | ⬜ | |
| 6 | MIRROR | ⬜ | ⬜ | |
| 7 | DVP | ⬜ | ⬜ | |
| 8 | COURT | ⬜ | ⬜ | |
| 9 | RELAY | ⬜ | ⬜ | |
| 10 | E2E | ⬜ | ⬜ | |
| 11 | FRONT | ⬜ | ⬜ | |
| 12 | REDTEAM | ⬜ | ⬜ | `doc/RED-TEAM-ES.md` |
| 13 | QA | ⬜ | ⬜ | `doc/QA-ES.md` |
| 14 | EXTATK | ⬜ | ⬜ | `doc/EXTATK-ES.md` |
| 15 | TESTNET | ⬜ | ⬜ | `doc/DEPLOY-TESTNET-ES.md` |
| 16 | SOLV | ⬜ | ⬜ | `make check` + portfolio |

---

## Hitos por fase

### 1. BOOT — Scaffold

- [ ] Autorizada
- [ ] Foundry + OZ v5 + `foundry.toml` (0.8.37, Cancun, fuzz/invariant)
- [ ] Anchor `title_mirror` + Token-2022 + feature `redteam`
- [ ] `shared/`, `relayer/`, `e2e/` (Node 22, vitest)
- [ ] `frontend/` Next.js 16 + Tailwind 4 + Playwright + CSP
- [ ] `Makefile`, `.cursorrules`, `.env.example`, pre-commit + `scripts/lint.sh`
- [ ] Herramientas: slither, aderyn, cargo-audit, Chromium (versiones en README)
- [ ] Criterio: C0; builds de humo verdes; hook bloquea lint malo

### 2. CODEC — Formato del mensaje

- [ ] Autorizada
- [ ] `doc/PROTOCOLO-ES.md` escrito
- [ ] `PacketCodec.sol` + `codec.rs` + `codec.ts` (TDD)
- [ ] Vectores dorados `test/vectors/packets.json`
- [ ] Criterio: C5 verde (tres lenguajes idénticos)

### 3. TITLE — Registro de títulos

- [ ] Autorizada
- [ ] `IdentityRegistry` (EIP-712, vencimiento, revocación)
- [ ] `TitleRegistry` + cumplimiento + `LedgerChain`
- [ ] Invariantes I1, I7, I9
- [ ] Criterio: tests verdes; cobertura TitleRegistry ≥ 90 %

### 4. ATTEST — Certificaciones

- [ ] Autorizada
- [ ] Emisión bloqueada sin certificación / vencida → `Rejected`
- [ ] Quórum de certificadores; `RoleOverlap` en deploy
- [ ] Criterio: I7 con vencimientos en fuzz

### 5. ENDPOINT — Puente Ethereum

- [ ] Autorizada
- [ ] Quórum, dominio, ids, `MsgType`, flow limit, pausa, timelock + época
- [ ] Invariantes I3, I8
- [ ] Tests unitarios R1, R5(a/b), R6, R7 (sin control positivo aún)
- [ ] Criterio: tests e invariantes verdes

### 6. MIRROR — Programa Solana

- [ ] Autorizada
- [ ] Config, set relayers, quórum secp256k1, `ISSUE`
- [ ] Mint Token-2022 + transfer hook + permanent delegate
- [ ] I5: hook rechaza caminos no autorizados
- [ ] R3 y R4 contra código real
- [ ] Criterio: `anchor test` verde

### 7. DVP — Entrega contra pago

- [ ] Autorizada
- [ ] Escrow Solana: request / decision / refund after hardDeadline
- [ ] Decisión Ethereum con D4 (deadline)
- [ ] I4, I6; P4, P6, P9
- [ ] Criterio: tests en ambas cadenas; carrera documentada en PROTOCOLO

### 8. COURT — Orden judicial y reconciliación

- [ ] Autorizada
- [ ] `FORCED_TRANSFER` + hash de resolución
- [ ] Reconciliación D6; rescate en especie
- [ ] P7
- [ ] Criterio: I1 e I2 se mantienen

### 9. RELAY — Relayers

- [ ] Autorizada
- [ ] Watchers, finalidad, firma, entrega, SQLite idempotente
- [ ] Reconciliador I2 + estados de solicitud
- [ ] API solo lectura `/status`, `/messages`
- [ ] Criterio: C9; API rechaza no-GET

### 10. E2E — Stack local

- [ ] Autorizada
- [ ] `e2e/stack.sh` (anvil + validator + deploy + 3 relayers)
- [ ] Ciclo de vida completo
- [ ] Fallas F1–F5
- [ ] Criterio: C10; D6 detectado y corregido

### 11. FRONT — Frontend

- [ ] Autorizada
- [ ] Vistas: explorador, cartera, operador, verificador, puente
- [ ] Guardas W2/W4; ES/EN; simulación previa a firmar
- [ ] Playwright contra stack local
- [ ] Criterio: C14–C17; capturas en `doc/`

### 12. REDTEAM — Seguridad en repo

- [ ] Autorizada
- [ ] R1–R7 con control positivo + rechazo en código real
- [ ] P1–P9; W1–W6; M1–M10
- [ ] Slither / Aderyn / audits justificados
- [ ] `doc/RED-TEAM-ES.md` completo
- [ ] Criterio: C4, C11, C12, C16 verdes

### 13. QA — Agente humano simulado

- [ ] Autorizada
- [ ] Personas: Titular, Comprador, Operador, Verificador, Público, Novato
- [ ] Guiones 1–10 ejecutados en stack local
- [ ] `doc/QA-ES.md` sin bloqueantes/mayores abiertos
- [ ] Criterio: fase QA cerrada

### 14. EXTATK — Otro agente atacante

- [ ] Autorizada
- [ ] Brief sin `test/redteam/`
- [ ] X1–X36 en local; cero `roto`
- [ ] `parcial` con dueño o aceptación
- [ ] `doc/EXTATK-ES.md` listo
- [ ] Lista corta para TESTNET preparada
- [ ] Criterio: catálogo local cerrado

### 15. TESTNET — Sepolia + Solana Devnet

- [ ] Autorizada
- [ ] Deploy Sepolia + Devnet + 3 relayers
- [ ] Ciclo completo desde UI (MetaMask + Phantom)
- [ ] Ataques: P1, R5b, P3 rechazados (con hash)
- [ ] Subconjunto EXTATK en testnet (mín. X1, X4, X7, X15, X17, X23, X25, X33; X28 si aplica)
- [ ] Smoke QA: ciclo feliz + rechazo por identidad
- [ ] `doc/DEPLOY-TESTNET-ES.md` con hashes **de ambas** redes
- [ ] Criterio: checklist de las dos testnets completo

### 16. SOLV — Cierre v1

- [ ] Autorizada
- [ ] Invariantes, gas, NatSpec
- [ ] QA + EXTATK + DEPLOY-TESTNET cerrados
- [ ] SWC-AUDIT, GAS, diagramas, docs EN, portfolio
- [ ] Índice suite actualizado
- [ ] Criterio: `make check` verde de punta a punta

---

## Hitos transversales (aceptación v1)

- [ ] Códec idéntico Solidity / Rust / TypeScript
- [ ] Invariantes I1–I9 cubiertas
- [ ] REDTEAM + mutación + estático cerrados
- [ ] QA cerrado
- [ ] EXTATK X1–X36 cerrado (local) + subconjunto en testnet
- [ ] Evidencia Sepolia
- [ ] Evidencia Solana Devnet
- [ ] Docs ES/EN + portfolio

---

## Próximo hito activo

1. Aceptar D1–D14 (marcar arriba).
2. Autorizar: *"Autorizo Fase BOOT"*.
3. Al cerrar BOOT: marcar tablero rápido + checklist de la fase; anotar fecha/nota.
