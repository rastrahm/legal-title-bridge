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
- [x] Comentarios en código: solo inglés, o bilingües ES+EN (nunca solo ES)
- [x] Docs de diseño: clases, flujo, flujograma, mapa de ataques, superficie de ataques (ES)
- [x] Decisiones D1–D14 revisadas y aceptadas (sobre todo D5/D6) — 2026-11-17
- [x] Primera fase autorizada: *"Autorizo Fase BOOT"* — 2026-11-17 · rama `boot`

---

## Tablero rápido

| # | Fase | Autorizada | Cerrada | Evidencia / nota |
|---|------|:----------:|:------:|------------------|
| 1 | BOOT | ✅ | ✅ | `make check-boot` OK · 2026-11-17 · rama `boot` |
| 2 | CODEC | ✅ | ✅ | `make check-codec` C5 OK · 2026-11-17 · rama `codec` |
| 3 | TITLE | ✅ | ✅ | `make check-title` · TitleRegistry 98.9% · I1/I7/I9 · 2026-11-17 · rama `title` |
| 4 | ATTEST | ✅ | ✅ | `make check-attest` · quorum 2/n · I7 con certs que vencen · 2026-11-18 · rama `attest` |
| 5 | ENDPOINT | ✅ | ✅ | `make check-endpoint` · I3/I8 · R1/R5a-b-c/R6/R7 · 2026-11-18 · rama `endpoint` |
| 6 | MIRROR | ✅ | ✅ | `make check-mirror` · R3/R4/R6 · I5 path · Token-2022 · 2026-11-18 · rama `mirror` |
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

- [x] Autorizada (2026-11-17, rama `boot`)
- [x] Foundry + OZ v5 + `foundry.toml` (0.8.37, Cancun, fuzz/invariant)
- [x] Anchor `title_mirror` + Token-2022 + feature `redteam`
- [x] `shared/`, `relayer/`, `e2e/` (Node 22, vitest)
- [x] `frontend/` Next.js 16 + Tailwind 4 + Playwright + CSP
- [x] `Makefile`, `.cursorrules`, `.env.example`, pre-commit + `scripts/lint.sh`
- [x] Herramientas: slither 0.11.6, aderyn 0.6.8, cargo-audit 0.23.0, Chromium Playwright
- [x] Criterio: C0; `make check-boot` verde; fixture lint falla a propósito; hook instalado

### 2. CODEC — Formato del mensaje

- [x] Autorizada (2026-11-17, rama `codec`)
- [x] `doc/PROTOCOLO-ES.md` escrito
- [x] `PacketCodec.sol` + `codec.rs` + `codec.ts` (TDD)
- [x] Vectores dorados `test/vectors/packets.json` (8 vectores)
- [x] Criterio: C5 verde (tres lenguajes idénticos) · `make check-codec`

### 3. TITLE — Registro de títulos

- [x] Autorizada (2026-11-17, rama `title`)
- [x] `IdentityRegistry` (EIP-712, vencimiento, revocación)
- [x] `TitleRegistry` + cumplimiento (`Country`/`MaxHolders`/`Lockup`) + `LedgerChain`
- [x] Invariantes I1, I7, I9
- [x] Criterio: tests verdes; cobertura TitleRegistry ≥ 90 % (98.9% líneas) · `make check-title`

### 4. ATTEST — Certificaciones

- [x] Autorizada (2026-11-18, rama `attest`)
- [x] Emisión bloqueada sin certificación / vencida → `Rejected(CertificationExpired)`
- [x] Quórum de certificadores (existencia + registral); `RoleOverlap` en deploy
- [x] Criterio: I7 con vencimientos en fuzz · `make check-attest`

### 5. ENDPOINT — Puente Ethereum

- [x] Autorizada (2026-11-18, rama `endpoint`)
- [x] Quórum, dominio, ids, `MsgType`, flow limit, pausa, timelock + época
- [x] Invariantes I3, I8
- [x] Tests unitarios R1, R5(a/b/c), R6, R7 (sin control positivo aún)
- [x] Criterio: tests e invariantes verdes · `make check-endpoint`

### 6. MIRROR — Programa Solana

- [x] Autorizada (2026-11-18, rama `mirror`)
- [x] Config, set relayers, quórum secp256k1, `apply_issue`
- [x] Mint Token-2022 + mint authority PDA (permanent delegate) + hook path checks
- [x] I5: `assert_transfer_path` / hook rechaza autoridades ajenas
- [x] R3 (sysvar Instructions) y R4 (mint/config constraints) contra código real
- [x] Criterio: `anchor test` + `cargo test -p title_mirror` verdes · `make check-mirror`

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

1. ~~Aceptar D1–D14~~ ✅ 2026-11-17
2. ~~BOOT~~ ✅ 2026-11-17
3. ~~CODEC~~ ✅ 2026-11-17 (`make check-codec` / C5 OK, rama `codec`)
4. ~~TITLE~~ ✅ 2026-11-17 (`make check-title`, I1/I7/I9, rama `title`)
5. ~~ATTEST~~ ✅ 2026-11-18 (`make check-attest`, rama `attest`)
6. ~~ENDPOINT~~ ✅ 2026-11-18 (`make check-endpoint`, I3/I8, R1/R5/R6/R7, rama `endpoint`)
7. ~~MIRROR~~ ✅ 2026-11-18 (`make check-mirror`, R3/R4/R6, I5, rama `mirror`)
8. Autorizar: *"Autorizo Fase DVP"*.
