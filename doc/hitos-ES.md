# Hitos — Módulo 22: Legal Title Bridge

> 🌐 [English](./hitos-EN.md) · **Español**

**Uso:** marcar `[x]` al cerrar cada ítem. No sustituye la autorización de fase (`Autorizo Fase <ID>` en `planificacion-ES.md`).
**Destino v1:** evidencia en **Sepolia** y **Solana Devnet** (ambas).
**Orden cerrado tras FRONT:** REDTEAM → QA → EXTATK → TESTNET → SOLV.
**EXTATK:** X1–X36 fijos en local; subconjunto obligatorio en testnet.
**Última actualización:** 2026-11-22

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
| 7 | DVP | ✅ | ✅ | 2026-11-18 |
| 8 | COURT | ✅ | ✅ | 2026-11-19 |
| 9 | RELAY | ✅ | ✅ | 2026-11-19 |
| 10 | E2E | ✅ | ✅ | `make check-e2e` C10 · sim harness + F1–F5/D6 · 2026-11-19 · rama `e2e` |
| 11 | FRONT | ✅ | ✅ | `make check-front` C14–C17 · 2026-11-19 · rama `front` |
| 12 | REDTEAM | ✅ | ✅ | `make check-redteam` C4/C11/C12/C16 · 2026-11-20 · rama `redteam` |
| 13 | QA | ✅ | ✅ | `make check-qa` · 6 personas + G1–G10 · 2026-11-20 · rama `qa` |
| 14 | EXTATK | ✅ | ✅ | `make check-extatk` · X1–X36 · 0 roto · 2026-11-20 · `doc/EXTATK-ES.md` |
| 15 | TESTNET | ✅ | ✅ | Cerrada 2026-11-23 · Deploy+UI+DvP · shortlist+X4 · X7/X15/X28 diferidos opc. · `doc/DEPLOY-TESTNET-ES.md` |
| 16 | SOLV | ✅ | ✅ | Cerrada 2026-11-23 · `make check` verde · docs EN + portfolio |

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

- [x] Autorizada (2026-11-18, rama `dvp`)
- [x] Escrow Solana: `request_transfer` / `apply_decision` / `refund_after_hard_deadline`
- [x] Decisión Ethereum con D4 + `TRANSFER_DECISION` outbound vía BridgeEndpoint
- [x] I4, I6; P4 (documentado), P6, P9
- [x] Criterio: tests en ambas cadenas; carrera D6 en `PROTOCOLO` §6.1 · `make check-dvp`

### 8. COURT — Orden judicial y reconciliación

- [x] Autorizada (2026-11-19, rama `court`)
- [x] `FORCED_TRANSFER` outbound + `apply_forced_transfer` / `apply_forced_p7` (Solana)
- [x] Reconciliación D6 (X20/X21); rescate en especie (`redeemInKind` → burn wire `to=0`)
- [x] P7: cancel Pending en Eth + escrow CourtCancelled en Solana
- [x] Criterio: I1 en Eth tras órdenes/rescates · `make check-court`

### 9. RELAY — Relayers

- [x] Autorizada (2026-11-19, rama `relay`)
- [x] Watchers Eth (confirmations/`finalized`) + Sol (`finalized`); signer; submitter quórum
- [x] SQLite (`node:sqlite`) idempotente + backoff exponencial
- [x] Reconciliador I2 + detección D6
- [x] API solo lectura `GET /status`, `GET /messages` (405 en no-GET)
- [x] Criterio: C9 · `make check-relay`

### 10. E2E — Stack local

- [x] Autorizada (2026-11-19, rama `e2e`)
- [x] `e2e/stack.sh` (`sim` por defecto: harness in-process; `full`: anvil + solana-test-validator)
- [x] Ciclo de vida completo (emisión → colocación → approve/reject/expire → court/P7 → redeem)
- [x] Fallas F1–F5 (kill/restart, double deliver, out-of-order, D6, reorg pre-confirm)
- [x] Criterio: C10 · `make check-e2e`; D6 detectado y corregido; reconciliador limpio en lifecycle

### 11. FRONT — Frontend

- [x] Autorizada (2026-11-19, rama `front`)
- [x] Vistas: explorador, cartera, operador, verificador, puente
- [x] Guardas W2/W4; ES/EN; simulación previa a firmar
- [x] Playwright contra stack local (flujos + W1–W6)
- [x] Criterio: C14–C17 · `make check-front`; capturas en `doc/front-screenshots/`

### 12. REDTEAM — Seguridad en repo

- [x] Autorizada (2026-11-20, rama `redteam`)
- [x] R1–R7 con control positivo + rechazo en código real
- [x] P1–P9; W1–W6; M1–M10
- [x] Slither / Aderyn / audits justificados (`doc/SWC-AUDIT-ES.md`)
- [x] `doc/RED-TEAM-ES.md` completo
- [x] Criterio: C4, C11, C12, C16 · `make check-redteam`

### 13. QA — Agente humano simulado

- [x] Autorizada (2026-11-20, rama `qa`)
- [x] Personas: Titular, Comprador, Operador, Verificador, Público, Novato
- [x] Guiones 1–10 ejecutados en stack local
- [x] `doc/QA-ES.md` sin bloqueantes/mayores abiertos
- [x] Criterio: fase QA cerrada · `make check-qa`

### 14. EXTATK — Otro agente atacante

- [x] Autorizada (agente atacante externo independiente — 2026-11-20)
- [x] Brief sin `test/redteam/` (acceso restringido; sin ver C11)
- [x] X1–X36 en local; **cero `roto`**; 34 bloqueado; 2 parcial (X30, X32 — por diseño)
- [x] `parcial` documentados con plan de cierre en `doc/EXTATK-ES.md §Notas`
- [x] `doc/EXTATK-ES.md` completo con tabla, notas y shortlist TESTNET
- [x] Lista corta TESTNET: X1, X4, X7, X15, X17, X23, X25, X28, X33
- [x] Criterio: catálogo local cerrado · `make check-extatk` verde

### 15. TESTNET — Sepolia + Solana Devnet

- [x] Autorizada (2026-11-21)
- [x] Deploy Sepolia + Devnet + 3 relayers (status API) — contratos + programa + config
- [x] Ciclo UI MetaMask + Phantom (2026-11-22): `registerAssertion` `0x146532…` · `issue` `0xa1b9…` · Phantom `EDTzyw…M4x5` (Cartera venta/compra = demo)
- [x] Ataques: P1 · R5b (firma inválida) · P3 Devnet · `apply_issue` mint=1000 · `executeRotateRelayers` + X4 ✅
- [x] Subconjunto EXTATK ejecutable: X1/X17/X23/X25/X33 ✅ · X4 ✅ (2026-11-23) · X7/X15/X28 diferidos opc.
- [x] Smoke QA: ciclo feliz Eth + rechazo identidad (`InvalidSignature`) + W2 MetaMask Mainnet→Sepolia
- [x] `doc/DEPLOY-TESTNET-ES.md` con direcciones/hashes (redeploy `2DvHn2…` + apply_issue + shortlist + UI)
- [x] Criterio: checklist completo — **fase cerrada 2026-11-23**

### 16. SOLV — Cierre v1

- [x] Autorizada (2026-11-23)
- [x] Invariantes I1–I9 documentadas + `forge test --mt invariant_` verde · gas `HotPath` + snapshot
- [x] QA + EXTATK + DEPLOY-TESTNET sin bloqueantes
- [x] SWC-AUDIT ES/EN · GAS ES/EN · diagramas EN stub · docs EN clave · portfolio/
- [x] Índice suite `doc/README.md` → 01–22
- [x] Criterio: `make check` verde de punta a punta (incluye `check-extatk` + `check-solv`) — **fase cerrada 2026-11-23**

---

## Hitos transversales (aceptación v1)

- [ ] Códec idéntico Solidity / Rust / TypeScript
- [ ] Invariantes I1–I9 cubiertas
- [x] REDTEAM + mutación + estático cerrados
- [x] QA cerrado
- [x] EXTATK X1–X36 cerrado (local) + subconjunto en testnet preparado
- [x] Evidencia Sepolia (deploy + UI `registerAssertion`/`issue` + P1/R5b/X1…)
- [x] Evidencia Solana Devnet (programa `2DvHn2…` + `apply_issue` + P3 + Phantom connect)
- [x] Docs ES/EN + portfolio (video walkthrough opcional)

---

## Próximo hito activo

1. ~~TESTNET~~ ✅ cerrada 2026-11-23
2. ~~SOLV~~ ✅ cerrada 2026-11-23 · `make check` verde · v1 lab completa
3. ~~REF-0…6~~ ✅ cerrada 2026-11-23 · [REFACTOR-ES.md](./REFACTOR-ES.md) · ABI/IDL/códec preservados · `make check` verde
4. Opcional: video walkthrough · X7/X15/X28 on-chain · residuales §13 (códec/I1–I9 checklist / mutantes)
