# Red team — resultados (C11 / C12 / C4 / C16)

> 🌐 [English](./RED-TEAM-EN.md) · **Español**

**Fase:** REDTEAM · **Rama:** `redteam` · **Fecha:** 2026-11-20  
**Regla:** cada ataque gana primero contra variante vulnerable (control positivo) y falla contra el código real con el error esperado (§10.1).

**Comando de cierre:** `make check-redteam`

---

## Matriz R1–R7 (incidentes reales)

| ID | Incidente | Vulnerable (éxito) | Real (rechazo) | Archivos |
|----|-----------|--------------------|----------------|----------|
| R1 | Poly Network | `MSG_SET_RELAYERS` + `rotateDirect` cambia el set | `UnsupportedMsgType`; epoch/relayers intactos | `test/redteam/R_Incidents.t.sol`, `vulnerable/VulnerableBridgeEndpoint.sol` |
| R2 | Qubit | `setTitleRegistry(EOA)` sin `code.length` | `EmptyCode` | idem |
| R3 | Wormhole | `require_instructions_sysvar_vulnerable` OK con clave falsa (`--features redteam`) | `require_instructions_sysvar` + constraint Anchor; TS R3 | `solana/.../quorum.rs`, `solana/tests/title_mirror.ts` |
| R4 | Cashio | (cuenta falsa / mint) — real vía TS I5/R4 | `MintMismatch` / constraints | `title_mirror.ts` |
| R5a | Ronin k−1 | inbound sin quórum (`requireQuorum=false`) | `InvalidQuorum` | `R_Incidents.t.sol` |
| R5b | Relayer/época vieja | `skipEpochCheck` | `WrongDomain` | idem |
| R5c | Vaciar con k | `drained` sin tope; pausa sí corta | `FlowLimitExceeded` / `Paused`; pérdida ≤ ventana | idem |
| R6 | Harmony 2-of-5 | constructor vulnerable con threshold 2/5 | `ThresholdTooLow` deploy/rotación | idem + `quorum.rs` |
| R7 | Nomad default-ok | accept sin firmas | `InvalidQuorum`; id no marcado | idem |

## Matriz P1–P9 (protocolo)

| ID | Ataque | Vulnerable | Real | Archivos |
|----|--------|------------|------|----------|
| P1 | Replay messageId | unmarked double apply | `MessageAlreadyProcessed` | `P_Protocol.t.sol`, `e2e/redteam` |
| P2 | Cross-domain / época | skip epoch | `WrongDomain` | `P_Protocol.t.sol` |
| P3 | Transfer fuera de escrow | `require_authorized_path_vulnerable` | `UnauthorizedTransferPath` | `hook.rs` + TS I5 |
| P4 | Carrera refund/approve | — | F4/D6 en e2e (divergencia detectada + reconcile) | `e2e/redteam`, `failures.test.ts` |
| P5 | Reentrancy pago | `payThenFinalize` reentra | CEI `payThenFinalizeSafe` (Eth v1 sin ERC20 de pago; demo en vulnerable) | `VulnerableTitleDecide.sol` |
| P6 | Comprador sin identidad | `decideBlind` | `Rejected` + `NOT_VERIFIED` | `P_Protocol.t.sol` |
| P7 | Orden + escrow | — | `COURT_ROLE` + `Court.t.sol` / Solana `apply_forced_p7` | unit Court + mirror |
| P8 | Montos inválidos | — | `ZeroAmount` | `P_Protocol.t.sol` |
| P9 | Refund third-party | — | TS DVP: refund paga a dueños | `title_mirror.ts` |

## Matriz W1–W6 (frontend)

Cubiertos en FRONT (C16): `frontend/e2e/attacks-w.spec.ts` + `frontend/e2e/vulnerable/xss-name.html` (W1). Re-ejecutados en `make check-redteam`.

| ID | Resultado |
|----|-----------|
| W1 | XSS escapado; vulnerable HTML ejecuta |
| W2 | Banner red + botones deshabilitados |
| W3 | `?endpoint=` / `?program=` ignorados (D14) |
| W4 | Confirmación desde tx decodificada |
| W5 | `frame-ancestors 'none'` + `X-Frame-Options: DENY` |
| W6 | Datos relayer no pisan verdad de cadena |

## Mutación M1–M10 (C12)

`scripts/mutate.sh` — **10/10 mutants killed** (2026-11-20).

| M | Control quitado | Test que mata |
|---|-----------------|---------------|
| M1 | Mark messageId | `test_P1_DuplicateMessageId` |
| M2 | Epoch en dominio | `test_R5b_RemovedRelayerWrongEpoch` |
| M3 | Deadline en decide | `test_DecideExpired_D4` |
| M4 | Certificación | `test_DecideRejectedCertExpired` |
| M5 | Identidad comprador | `test_P6_DecideRejected_NotVerified` |
| M6 | Flow limit | `test_R5c_FlowLimitAndPause` |
| M7 | ⌈2n/3⌉ | `test_R6_DeployThresholdTooLow` |
| M8 | Sysvar Instructions | `r3_real_rejects_fake_sysvar_key` |
| M9 | `token::mint` pago | assert fuente request_transfer |
| M10 | Hook authority | `allows_delegate_and_escrow` |

## Análisis estático (C4)

Ver [`SWC-AUDIT-ES.md`](./SWC-AUDIT-ES.md). High/Medium justificados; npm audit limpio; warnings `cargo audit` transitivas documentadas.

## Capacidades del atacante (declaradas)

| Escenario | Capacidad |
|-----------|-----------|
| R1/R7/P1/P2 | Público + crafting de wire/firmas |
| R5a | k = umbral − 1 |
| R5b | Firmas de época anterior / set viejo |
| R5c | k = umbral (2 de 3) + medición de drenaje |
| R6 | Deploy/rotación maliciosa |
| R2 | Admin o path de config engañado |
| R3/R4/P3 | Cuentas falsas / sysvar falso / mint falso |
| W* | Navegador + DOM / URL / iframe / API relayer mentira |

## Criterio de salida

- [x] C11 — `forge test --match-path 'test/redteam/*'` + `cargo test -p title_mirror --features redteam` + `vitest run redteam`
- [x] C12 — `scripts/mutate.sh`
- [x] C4 — slither/aderyn + este SWC
- [x] C16 — Playwright W1–W6 (re-check en `make check-redteam`)
