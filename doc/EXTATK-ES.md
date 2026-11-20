# EXTATK — Informe de Ataques Profundos X1–X36

**Fecha:** 2026-11-20  
**Agente:** atacante externo (perspectiva caja gris/negra independiente)  
**Stack objetivo:** Legal Title Bridge v1 — código de producción en `src/`, `solana/programs/title_mirror/src/`, `shared/`, `e2e/src/`, `frontend/src/`  
**Restricciones:** sin acceso a `test/redteam/`, `doc/RED-TEAM-ES.md`, ni afirmaciones C11.  
**Resumen:** 36 ataques intentados; **0 roto**, **34 bloqueado**, **2 parcial** (por diseño).

---

## Tabla de Resultados X1–X36

| ID | Ataque | Capacidad atacante | Efecto observado | Mecanismo de defensa | Veredicto | Fuente evidencia |
|----|--------|-------------------|-----------------|---------------------|-----------|-----------------|
| X1 | `srcChain`/`dstChain` intercambiados | Firmas públicas ya emitidas | `WrongDomain` revert | `_requireInboundDomain`: `packet.dstChain != LOCAL_CHAIN_ID` | **bloqueado** | `test/extatk/X01_X08_BridgeDomain.t.sol::test_X1_swappedDomains_revertWrongDomain` |
| X2 | Mutilar un byte del payload tras firmar | Firmas + wire interceptado | `InvalidQuorum` revert | `messageIdOfWire = keccak256(wire)` ata payload al digest | **bloqueado** | `test/extatk/X01_X08_BridgeDomain.t.sol::test_X2_mutatedPayload_revertInvalidQuorum` |
| X3 | Mismo `messageId` con otro `MsgType` re-entregado | Firmas + mempool | `MessageAlreadyProcessed` | `MessageIdSet.add` marca el id antes de efectos (I3/CEI) | **bloqueado** | `test/extatk/X01_X08_BridgeDomain.t.sol::test_X3_replayWithDifferentMsgType_revertAlreadyProcessed` |
| X4 | Firmas de época anterior en BridgeEndpoint Ethereum | 1 relayer removido + firmas epoch-1 | `WrongDomain` revert | `packet.epoch != endpoint.epoch` en `_requireInboundDomain` | **bloqueado** | `test/extatk/X01_X08_BridgeDomain.t.sol::test_X4_oldEpochAfterRotation_revertWrongDomain` |
| X5 | k−1 firmas válidas + 1 firma de clave no-relayer | k−1 claves | `InvalidQuorum` | `RelayerQuorum.verify`: signer no está en set → false | **bloqueado** | `test/extatk/X01_X08_BridgeDomain.t.sol::test_X5_belowThresholdWithNonRelayer_revertInvalidQuorum` |
| X6 | Dos coaliciones entregan el mismo mensaje en paralelo | k = umbral en dos coaliciones | 2.ª entrega: `MessageAlreadyProcessed` | `MessageIdSet` impide el segundo `add` | **bloqueado** | `test/extatk/X01_X08_BridgeDomain.t.sol::test_X6_doubleDeliveryRace_secondReverts` |
| X7 | Mensaje ISSUE con cantidad fragmentada en N por debajo del tope | k = umbral | `FlowLimitExceeded` al agotar la ventana | `FlowLimiter.checkAndConsume`: acumula consumo en ventana de 24 h | **bloqueado** | `test/extatk/X01_X08_BridgeDomain.t.sol::test_X7_flowWindowFragmentation_revertFlowLimit` |
| X8 | Envío inbound o outbound con bridge pausado | Guardián + k = umbral | `Paused` revert en ambas direcciones | `if (paused) revert BridgeErrors.Paused()` en `submitInbound` y `emitOutbound` | **bloqueado** | `test/extatk/X01_X08_BridgeDomain.t.sol::test_X8_submitWhilePaused_revertPaused` y `test_X8_emitOutboundWhilePaused_revertPaused` |
| X9 | Afirmación EIP-712 con `chainId` incorrecto (fork) | Clave de verificador de fork/local | `InvalidSignature` revert | Separador de dominio EIP-712 incluye chainId real; mismatch → recovered signer ≠ verifier | **bloqueado** | `test/extatk/X09_X13_Identity.t.sol::test_X9_wrongChainIdAssertion_revertInvalidSignature` |
| X10 | Certificación vence entre TRANSFER_REQUEST y `decide()` | Reloj + certificador | Decisión `Rejected` con reasonCode=2 | `attestationRegistry.isCertified` reevaluado en `decide()` → `CERTIFICATION_EXPIRED` | **bloqueado** | `test/extatk/X09_X13_Identity.t.sol::test_X10_certExpiredBeforeDecide_rejectWithCertExpired` |
| X11 | Comprador verificado pierde identidad (revocación) antes de `decide()` | Verificador + comprador | Decisión `Rejected` con reasonCode=1 | `identityRegistry.isVerified(req.buyer)` reevaluado en `decide()` → `NOT_VERIFIED` | **bloqueado** | `test/extatk/X09_X13_Identity.t.sol::test_X11_buyerRevokedBeforeDecide_rejectNotVerified` |
| X12 | Certifier firma dos veces; otro no firma | Emisor + 1 certifier | `isCertified` = false; `issue()` → `CertificationExpired` | `AttestationRegistry.liveCount` cuenta direcciones distintas; 1/2 < threshold=2 | **bloqueado** | `test/extatk/X09_X13_Identity.t.sol::test_X12_certifierDoubleSign_quorumNotMet` |
| X13 | Activo `Frozen` con solicitud `Pending` | Operador / tribunal | Decisión `Rejected` con reasonCode=3 (Frozen) o 4 (Paused) | `_evaluateApproval` comprueba `assetState` en el momento de `decide()` | **bloqueado** | `test/extatk/X09_X13_Identity.t.sol::test_X13_frozenAssetWithPendingRequest_rejectAssetFrozen` y `test_X13b` |
| X14 | RPC mentiroso reordena/inserta entradas en la cadena de asientos | RPC propio o mitm local | `verifyLedgerChain` detecta `breakAt` y retorna `ok=false` | Hash encadenado `keccak256(prevHash ‖ data)`; cualquier reorden o inyección rompe la cadena | **bloqueado** | `e2e/extatk/x14-x32.test.ts::X14` (3 casos) |
| X15 | Aprobación llega exactamente en `hardDeadline`; reembolso en el mismo slot | Comprador + relayers lentos | Aprobación tardía → `LateApprovalRejected`; reembolso → `Refunded` | `dvp::require_approved_before_hard_deadline(now, hard_deadline)` en Solana | **bloqueado** | `e2e/extatk/x14-x32.test.ts::X15` |
| X16 | `refund_after_hard_deadline` invocado por tercero | Cualquiera | Reembolso ejecutado; fondos van a seller (título) y buyer (pago), no al llamante | Cuentas destino hardcoded en PDA: `seller_title_ata.owner == escrow.seller` (P9) | **bloqueado** | `e2e/extatk/x14-x32.test.ts::X16` |
| X17 | Depósito de pago con mint distinto al declarado en la solicitud | Comprador malicioso | `MintMismatch` revert en Solana | Anchor constraint: `payment_mint.key() == escrow.payment_mint @ MirrorError::MintMismatch` | **bloqueado** | `e2e/extatk/x14-x32.test.ts::X17` + `e2e/extatk/x22-x27-solana-evidence.ts` |
| X18 | Depósito parcial: menos tokens de los requeridos | Titular/comprador | `registerRequest` lanza `insufficient sol balance` si balance < amount | Validación en `registerRequest`: `if (bal < req.amount) throw` | **bloqueado** | `e2e/extatk/x14-x32.test.ts::X18` |
| X19 | Cancelación del vendedor tras depósito del comprador (distintos órdenes) | Ambos | Reembolso correcto (hardDeadline) o cancelación P7 (tribunal) | `refundAfterHardDeadline` + `forcedTransfer` con P7 → `CourtCancelled` | **bloqueado** | `e2e/extatk/x14-x32.test.ts::X19` |
| X20 | Reconciliación D6 aplicada dos veces con el mismo hash | Operador comprometido | 2.ª llamada → `RequestNotApproved` revert | `req.status != RequestStatus.Approved` antes de reconciliar; estado pasa a `Reconciled` tras la 1.ª | **bloqueado** | `test/extatk/X20_X21_Reconcile.t.sol::test_X20_doubleReconcile` + `e2e/extatk/x14-x32.test.ts::X20` |
| X21 | Reconciliación con hash vacío (`bytes32(0)`) o sin ancla | Operador comprometido | `ZeroAddress` revert (hash vacío) o `RequestNotApproved` (estado incorrecto) | `if (resolutionHash == bytes32(0)) revert ZeroAddress()` | **bloqueado** | `test/extatk/X20_X21_Reconcile.t.sol::test_X21_reconcileZeroHash` + `test_X21b` |
| X22 | Sustituir cuentas de instrucción por otro owner mismo layout (Cashio) | Programa atacante | `ConstraintSeeds` revert de Anchor | Cada PDA: `seeds=[…], bump=account.bump`; address determinista por (seeds, program_id) | **bloqueado** | `e2e/extatk/x22-x27-solana-evidence.ts::X22` |
| X23 | Sysvar de instrucciones falso + instrucción secp256k1 fabricada | Cualquiera | Revert por constraint de dirección + `require_instructions_sysvar()` | `#[account(address = sysvar::instructions::ID)]` + `require_keys_eq!(info.key, INSTRUCTIONS_ID)` | **bloqueado** | `e2e/extatk/x22-x27-solana-evidence.ts::X23` + cargo test `r3_real_rejects_fake_sysvar_key` |
| X24 | CPI desde intermediario que no es escrow (`transfer hook` bypass) | Programa atacante | `UnauthorizedTransferPath` revert del hook | `hook::classify_authority` rechaza cualquier authority != permanent_delegate ni escrow_authority | **bloqueado** | `e2e/extatk/x22-x27-solana-evidence.ts::X24` + cargo test `allows_delegate_and_escrow` |
| X25 | Transfer con delegate no autorizado / burn / close account | Titular + cuentas auxiliares | Hook rechaza la transferencia | mismo `require_authorized_path` en cada transferencia Token-2022 | **bloqueado** | `e2e/extatk/x22-x27-solana-evidence.ts::X25` |
| X26 | Recrear PDA de escrow con seeds distintas tras cierre | Cualquiera | Dirección distinta (derivación criptográfica); discriminator check en `init` | PDA = findProgramAddress(seeds, program_id); colisión computacionalmente infeasible | **bloqueado** | `e2e/extatk/x22-x27-solana-evidence.ts::X26` |
| X27 | Mint Token-2022 con extensiones extra coladas en la emisión | Emisor de mint paralelo | `MintMismatch` revert en instrucciones posteriores | Asset PDA guarda `mint` pubkey en `initialize_asset`; constraint `title_mint.key() == escrow.title_mint` | **bloqueado** | `e2e/extatk/x22-x27-solana-evidence.ts::X27` |
| X28 | Reorg profunda en anvil/cadena local antes de confirmations | Control del nodo local | Mensaje nunca almacenado ni entregado | `RelayerFleet.observe`: solo inserta cuando `head - emittedAt >= confirmations` | **bloqueado** | `e2e/extatk/x14-x32.test.ts::X28` |
| X29 | Evento sintético con mismos topics desde contrato clon | Contrato atacante | `MessageAlreadyProcessed` al segundo intento | `solProcessed` set (I3); messageId = keccak256(wire) ata el contenido | **bloqueado** | `e2e/extatk/x14-x32.test.ts::X29` |
| X30 | API de relayer devuelve estados terminales falsos | Relayer HTTP comprometido | Divergencia D6 detectada por reconciliador | Reconcile report expone el mismatch; API es read-only GET (C9); operador debe actuar | **parcial** | `e2e/extatk/x14-x32.test.ts::X30` *(ver nota)* |
| X31 | Relayer firma mensajes de un emitter distinto al endpoint | 1 clave de relayer | No puede pasar validación de dominio en Solana | `packet.emitter == config.eth_endpoint @ MirrorError::WrongDomain` en `apply_decision.rs:139` | **bloqueado** | `e2e/extatk/x14-x32.test.ts::X31` |
| X32 | Agotar ventana de flujo con transferencias propias (griefing) | k = umbral + capital | Terceros bloqueados hasta que la ventana se reinicia (24 h) | Límite de flujo por diseño (D12); ventana siempre se resetea; no hay pérdida permanente | **parcial** | `e2e/extatk/x14-x32.test.ts::X32` *(ver nota)* |
| X33 | Clonar UI cambiando shared/ embebido | Sitio clonado | Endpoint en URL ignorado; shared/ address siempre mostrado al usuario | `resolveAddresses`: `void searchParams` (D14); address proviene de shared/ | **bloqueado** | `frontend/e2e/extatk-x33-x36.spec.ts::X33` |
| X34 | Firma EIP-712 con campos en orden distinto o tipos alias | DApp maliciosa | ConfirmTxPanel muestra parámetros reales del tx, no del form (W4) | `ConfirmTxPanel` decodifica el tx real; form values no llegan al digest | **bloqueado** | `frontend/e2e/extatk-x33-x36.spec.ts::X34` |
| X35 | Metadatos con homógrafos Unicode y RTL override | Emisor malicioso | Renderizado como texto plano; direcciones hex-only sin Cyrillic/RTL | React renderiza texto sin `dangerouslySetInnerHTML`; bytes32 son hex-only | **bloqueado** | `frontend/e2e/extatk-x33-x36.spec.ts::X35` |
| X36 | Deep link / query params pre-rellenando montos y destinatarios | Sitio ajeno / phishing | Parámetros ignorados; shared/ fija addresses; ConfirmTxPanel muestra tx real | D14 + W3 + W4; URL no contiene claves ni mnemonics | **bloqueado** | `frontend/e2e/extatk-x33-x36.spec.ts::X36` |

---

## Notas sobre ítems `parcial`

### X30 — API de relayer devuelve estados terminales falsos
- **Situación:** la API HTTP del relayer es GET-only y de lectura (C9). Un operador que confíe ciegamente en la API sin cruzar con la cadena puede actuar sobre datos falsos.
- **Mitigación existente:** el reconciliador `buildReconcileReport` detecta divergencias D6 y las expone. El operador debe hacer la reconciliación on-chain manualmente.
- **Plan de cierre:** en TESTNET, se verificará que la divergencia D6 aparece en el informe y que el operador puede ejecutar `reconcile()` correctamente.
- **Prioridad:** no bloquea EXTATK; se documenta como riesgo operacional conocido.

### X32 — Griefing de ventana de flujo
- **Situación:** un actor con suficiente capital puede agotar la ventana de 24 h de FlowLimiter, bloqueando a terceros durante esa ventana.
- **Mitigación existente:** la ventana se reinicia cada 24 h; el operador puede ajustar `maxPerWindow` con `setFlowLimits` (D12). No hay pérdida de fondos.
- **Plan de cierre:** en TESTNET, se verificará que la ventana se restablece y que un operador puede ampliarla.
- **Prioridad:** aceptado como trade-off de diseño (D12); no bloquea EXTATK.

---

## Resumen ejecutivo

| Veredicto | Cantidad | IDs |
|-----------|----------|-----|
| **bloqueado** | 34 | X1–X29, X31, X33–X36 |
| **parcial** | 2 | X30, X32 |
| **roto** | 0 | — |

**Criterio EXTATK cumplido:** cero `roto`; los dos `parcial` están documentados con plan de cierre.

---

## Shortlist TESTNET (re-ejecución obligatoria)

| ID | Justificación re-ejecución |
|----|---------------------------|
| X1 | Reenvío de paquete con cadenas intercambiadas en Sepolia → Devnet real |
| X4 | Rotación de relayers real + firma de época anterior |
| X7 | Llenado de ventana de flujo on-chain |
| X15 | Race hardDeadline con bloques reales (slot timing Devnet) |
| X17 | Sustitución de mint en instrucción Solana real |
| X23 | Sysvar falso en transacción Devnet |
| X25 | Transfer con delegate no autorizado en token-2022 real |
| X28 | Reorg simulada en Sepolia con `confirmations − 1` |
| X33 | Clone UI contra dev server en TESTNET (si aplica) |

---

## Archivos de evidencia

| Tipo | Ruta |
|------|------|
| Solidity (forge) | `test/extatk/X01_X08_BridgeDomain.t.sol` |
| Solidity (forge) | `test/extatk/X09_X13_Identity.t.sol` |
| Solidity (forge) | `test/extatk/X20_X21_Reconcile.t.sol` |
| E2E vitest | `e2e/extatk/x14-x32.test.ts` |
| Solana evidencia | `e2e/extatk/x22-x27-solana-evidence.ts` |
| Frontend Playwright | `frontend/e2e/extatk-x33-x36.spec.ts` |
| Make target | `make check-extatk` |
