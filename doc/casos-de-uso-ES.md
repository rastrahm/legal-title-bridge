# Casos de uso — Legal Title Bridge

**Idioma:** Español · Laboratorio v1 (Sepolia + Solana Devnet / UI local).  
**Reglas:** Ethereum manda; el frontend **no** es verdad on-chain (D14); direcciones solo desde `shared/`.  
**Companions:** [`manual-de-ayuda-ES.md`](./manual-de-ayuda-ES.md) · [`flujograma-ES.md`](./flujograma-ES.md) · [`QA-ES.md`](./QA-ES.md).  
**UI:** panel «Ayuda de esta pantalla» en cada vista (`ContextualHelp` / `frontend/src/lib/help/content.ts`).

---

## Actores

| Actor | Billetera | Pantallas típicas |
|-------|-----------|-------------------|
| Verificador / certificador | MetaMask | `/verificador` |
| Emisor / operador / guardián / ejecutor judicial | MetaMask | `/operador` |
| Titular (vendedor) | Phantom | `/cartera` |
| Comprador | Phantom | `/cartera` |
| Público / observador | — | `/`, `/activos`, `/puente` |
| Novato (misma UI, red o rol incorrectos) | MetaMask / Phantom | cualquiera |

---

## Índice de situaciones

| ID | Situación | Actor principal |
|----|-----------|-----------------|
| UC-01 | Registrar identidad (KYC) del titular | Verificador |
| UC-02 | Certificar un activo | Certificador (issuer/operator) |
| UC-03 | Emitir unidades del título | Emisor |
| UC-04 | Consultar ficha y ledger de un activo | Público |
| UC-05 | Vender (crear solicitud DvP) | Titular |
| UC-06 | Comprar (depositar pago) | Comprador |
| UC-07 | Cancelar venta pendiente | Titular |
| UC-08 | Rechazo por identidad / certificación | Sistema + UI |
| UC-09 | Vencimiento de plazos y reembolso | Titular / comprador |
| UC-10 | Pausar el puente / registro | Guardián |
| UC-11 | Orden judicial (transferencia forzada) | Ejecutor judicial |
| UC-12 | Reconciliar divergencia D6 | Operador |
| UC-13 | Monitorear el puente (I2, mensajes) | Público |
| UC-14 | Red incorrecta (W2) | Novato |
| UC-15 | Cuenta sin rol / firma inválida | Novato / atacante accidental |
| UC-16 | Campos incompletos en verificador | Verificador |
| UC-17 | Ingreso como comprador (sin rol) | Comprador |

---

## UC-01 — Registrar identidad del titular

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Dejar al titular `holder` verificado en `IdentityRegistry` con país, tipo de inversor y vencimiento. |
| **Precondiciones** | MetaMask en la red del lab (local 31337 o Sepolia); cuenta con rol **verifier**; IdentityRegistry desplegado. |
| **Disparador** | Operador o negocio pide onboarding KYC antes de emitir o transferir. |
| **Flujo principal** | 1. Abrir `/verificador`. 2. Conectar MetaMask (cuenta verifier). 3. Completar titular (bytes32), país, tipo, fecha. 4. Revisar vista previa (código país + unix). 5. **Firmar identidad** (EIP-712). 6. Confirmar tx `registerAssertion`. |
| **Alternativas** | A1 Campos incompletos → UC-16. A2 Cuenta sin rol → UC-15 (`InvalidSignature`). A3 Red mala → UC-14. |
| **Postcondiciones** | `isVerified(holder) == true` hasta `expiry` o `revoke`. |
| **Captura** | `doc/qa-screenshots/q-verificador.png` |

---

## UC-02 — Certificar un activo

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Acumular firmas EIP-712 de certificadores hasta el quórum del `AttestationRegistry` (existencia / estado registral). |
| **Precondiciones** | Activo conocido (`assetId`); cuentas issuer/operator según política de firmas; MetaMask en red correcta. |
| **Disparador** | Antes de `issue` (I7: emisión exige certificaciones vigentes). |
| **Flujo principal** | 1. `/verificador`. 2. Elegir `assetId` y tipo de certificación. 3. Firmar con la cuenta certificadora. 4. Repetir con la segunda clave del quórum si aplica. 5. Comprobar en `/activos/[assetId]` que la certificación aparece activa. |
| **Alternativas** | A1 Quórum incompleto → `issue` bloqueado. A2 Certificación vencida → UC-08 en DvP. |
| **Postcondiciones** | Asset certificado; listo para emisión. |

---

## UC-03 — Emitir unidades

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Acuñar unidades en Ethereum (`TitleRegistry.issue`) y emitir mensaje `ISSUE` hacia Solana. |
| **Precondiciones** | Holder verificado (UC-01); asset certificado (UC-02); cuenta **issuer**; puente cableado. |
| **Disparador** | Emisión inicial del lote. |
| **Flujo principal** | 1. `/operador` + Conectar MetaMask (issuer). 2. Completar `assetId`, monto, holder (bytes32). 3. **Emitir** → panel de confirmación (valores **decodificados de la tx**, no del formulario a ciegas — W4). 4. Firmar en MetaMask. 5. En testnet: relayers entregan; Solana `apply_issue` mintea Token-2022. 6. Verificar I2 en `/puente`. |
| **Alternativas** | A1 Sin rol issuer → botón deshabilitado / revert. A2 Sin certificación → revert on-chain. A3 Pausa activa → UC-10 bloquea. |
| **Postcondiciones** | Saldo Eth del holder ↑; mensaje `ISSUE` outbound; (testnet) mint Solana espejo. |
| **Evidencia testnet** | `issue` UI `0xa1b9…` · `doc/DEPLOY-TESTNET-ES.md` |
| **Captura** | `doc/front-screenshots/operador.png` · `doc/qa-screenshots/g1-happy.png` |

---

## UC-04 — Consultar ficha y ledger

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Inspeccionar nombre, holders, certificaciones y cadena de asientos **recalculada en el navegador**. |
| **Precondiciones** | Ninguna billetera requerida. |
| **Disparador** | Auditoría pública / due diligence. |
| **Flujo principal** | 1. `/activos`. 2. Abrir un `assetId`. 3. Leer certificaciones y titulares. 4. Ver estado del ledger (íntegro / roto en asiento N). |
| **Alternativas** | A1 `assetId` inválido → pantalla de error. A2 Ruta inexistente → 404. |
| **Postcondiciones** | Solo lectura; no cambia estado. |
| **Captura** | `doc/front-screenshots/activo-detalle.png` · `doc/qa-screenshots/q-publico.png` |

---

## UC-05 — Vender (publicar + aceptar → link DvP)

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Publicar un lote y, al aceptar una oferta, firmar como vendedor y generar el link de co-firma. |
| **Precondiciones** | Phantom Devnet; C1 con saldo del mint título; comprador distinto (C2). |
| **Disparador** | Titular quiere vender N unidades a un precio (Lab USD). |
| **Flujo principal (UI testnet)** | 1. `/cartera/vender` + Conectar Phantom (C1). 2. **Publicar lote** (cantidad). 3. Esperar oferta de C2 (UC-06). 4. **Aceptar oferta** → Phantom: approve + firma vendedor. 5. **Copiar link** `/cartera/firmar#…` y enviarlo a C2 (~1 min de validez). |
| **Protocolo** | Tras la firma de C2 (UC-06): `request_transfer` escrow on-chain → relayers → Eth `TRANSFER_REQUEST`. |
| **Alternativas** | A1 Sin conectar / red incorrecta. A2 Auto-compra bloqueada (C1=C2). A3 Link expirado → volver a Aceptar. A4 Cancelar oferta → UC-07. |
| **Postcondiciones** | Link listo para C2; tras UC-06, escrow con título+pago. |
| **Captura** | `doc/qa-screenshots/q-titular.png` |

---

## UC-06 — Comprar (oferta + firmar escrow)

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Registrar interés y, con el link del vendedor, firmar el `request_transfer` liberando Lab USD al escrow. |
| **Precondiciones** | Lote publicado (UC-05); Phantom C2 ≠ C1; ATA Lab USD con saldo; link vigente. |
| **Flujo principal (UI testnet)** | 1. `/cartera/comprar` + Phantom C2. 2. **Comprar** → oferta Pending (sin tx). 3. Abrir el link que mandó C1 → `/cartera/firmar`. 4. Conectar C2 → **Firmar y enviar escrow**. |
| **Protocolo** | Firma comprador completa el escrow atómico (título C1 + pago C2). Eth decide después; settle libera fondos. |
| **Postcondiciones** | Escrow on-chain; saldos C1 título ↓ y C2 Lab USD ↓; cobro final pendiente de Eth. |
| **Captura** | `doc/qa-screenshots/q-comprador.png` |

---

## UC-07 — Cancelar oferta / listado pendiente

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Abortar una oferta Pending **antes** de que C2 cierre el escrow. |
| **Precondiciones** | Oferta Pending propia en `/cartera/vender`. |
| **Flujo UI** | **Cancelar** en la oferta → el listado puede volver a Open en la sesión. |
| **Postcondiciones** | Oferta ya no accionable; si el escrow ya se envió, no aplica cancel UI. |

---

## UC-08 — Rechazo por identidad / certificación

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Eth decide `Rejected` con motivo legible (comprador sin KYC, cert vencida, asset frozen/paused…). |
| **Precondiciones** | `TRANSFER_REQUEST` Pending; `decide()` reevalúa I7 en el momento de la decisión. |
| **Flujo** | Operador/automático llama `decide` → `TRANSFER_DECISION Rejected(reason)` → Solana refund según plazo. |
| **UI** | En cartera, ejemplos lab muestran textos: «Rechazado: comprador sin identidad vigente» / «certificación vencida…». |
| **Postcondiciones** | Fondos/tokens liberados según D4–D6; no Completed. |

---

## UC-09 — Vencimiento y reembolso

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Tras `deadline`, Eth solo puede `Expired`; tras `hardDeadline` (+7d), Solana permite `refund_after_hard_deadline`. |
| **Precondiciones** | Solicitud con escrow abierto. |
| **Flujo** | Ver [`flujograma-ES.md`](./flujograma-ES.md) § plazos. UI muestra hint de deadline/hardDeadline. |
| **Postcondiciones** | Escrow vaciado; Approved tardío post-hardDeadline se rechaza (D6 → UC-12). |

---

## UC-10 — Pausar

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Guardián pausa operaciones sensibles (bridge / registro según rol). |
| **Precondiciones** | Cuenta con rol **guardian**. |
| **Flujo UI** | `/operador` → **Pausar** (habilitado solo con rol). |
| **Postcondiciones** | Emisión / inbound pueden revertir `Paused`; reduce daño si hay quórum comprometido (D12). |
| **Captura** | `doc/qa-screenshots/q-operador.png` |

---

## UC-11 — Orden judicial

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Ejecutar `FORCED_TRANSFER` anclado a `resolutionHash` (delegado permanente en Solana). |
| **Precondiciones** | Rol **courtExecutor**; hash de resolución no vacío. |
| **Flujo** | `/operador` → **Orden judicial** → confirmar tx → mensaje outbound → `apply_forced_*` en Solana. |
| **Postcondiciones** | Movimiento por vía judicial; asiento con ancla. |

---

## UC-12 — Reconciliar D6

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Corregir divergencia Eth↔Sol tras Approved tardío / fallo de relayers (informe + `resolutionHash`). |
| **Precondiciones** | Rol **operator**; hash de resolución válido; solicitud en estado reconciliable. |
| **Flujo** | Detectar I2/estado malo en `/puente` → `/operador` → **Reconciliar D6**. |
| **Alternativas** | Doble reconcile / hash cero → revert (X20/X21). |
| **Postcondiciones** | Estado alineado; no doble acuñación. |

---

## UC-13 — Monitorear el puente

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Ver mensajes (visto/firmado/entregado), relayers y semáforo I2. |
| **Precondiciones** | Ninguna (lectura). Relayer status API GET opcional. |
| **Flujo** | Abrir `/puente`; interpretar verde/rojo I2; no tratar datos del relayer como verdad (copy «informado por el relayer»). |
| **Captura** | `doc/front-screenshots/puente.png` |

---

## UC-14 — Red incorrecta (W2)

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Impedir firmar si la billetera **conectada** no está en la red esperada. |
| **Disparador** | MetaMask en Mainnet con app en Sepolia; o Phantom fuera de Devnet. |
| **Flujo** | Banner «Red incorrecta…»; botones de firma deshabilitados; usuario cambia de red → se recupera. |
| **Nota UX** | El banner **no** debe alarmar en `/cartera` si MetaMask no está conectada. |
| **Captura** | `doc/qa-screenshots/q-novato.png` |

---

## UC-15 — Cuenta sin rol / firma inválida

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Rechazar acciones privilegiadas con cuenta equivocada. |
| **Flujo UI** | Botones deshabilitados (`roleDisabled`) o, si se fuerza firma, revert `InvalidSignature` / `Unauthorized`. |
| **Evidencia testnet** | Cuenta no-verifier → `InvalidSignature` (`0x8baa579f`). |
| **Lab** | Botón «Quitar roles (lab)» simula pérdida de privilegios en demo. |

---

## UC-16 — Campos incompletos (verificador)

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | No preparar EIP-712 con datos a medias. |
| **Flujo** | Vaciar país u otros campos → aviso `#id-incomplete` + botón Firmar deshabilitado + `aria-describedby`. |
| **Postcondiciones** | Ninguna tx enviada. |

---

## UC-17 — Ingreso como comprador

| Campo | Contenido |
|-------|-----------|
| **Objetivo** | Que un cliente nuevo entre al producto como comprador **sin** `BUYER_ROLE` ni admin. |
| **Precondiciones** | Phantom (Devnet en testnet); IdentityRegistry desplegado para leer `isVerified`. |
| **Disparador** | Usuario elige **Comprador** en la nav o desde Inicio. |
| **Flujo principal** | 1. `/comprador`. 2. Conectar Phantom. 3. Ver holder = pubkey Solana como `bytes32` (D2); copiar o abrir Verificador con `?holder=`. 4. Actualizar estado KYC (`isVerified`). 5. Confirmar ingreso (sesión UI). 6. Ir a Activos / Cartera. |
| **Alternativas** | A1 Sin Phantom → no hay holder. A2 Sin KYC → puede explorar; compras I7 fallarán on-chain. A3 RPC caído → estado «unknown». |
| **Postcondiciones** | Holder conocido; verificación leída de cadena; **ningún** rol AccessControl creado. |
| **UI** | `/comprador` · ayuda contextual `comprador` |

---

## Trazabilidad persona QA ↔ casos

| Persona QA | Casos cubiertos |
|------------|-----------------|
| Q-Titular | UC-05, UC-07 |
| Q-Comprador | UC-06, UC-17 |
| Q-Operador | UC-03, UC-10, UC-11, UC-12, UC-15 |
| Q-Verificador | UC-01, UC-02, UC-16 |
| Q-Público | UC-04, UC-13 |
| Q-Novato | UC-14, UC-15 |

---

## Fuera de alcance UI v1 (protocolo sí)

- Settle completo (decisión Eth → liberar escrow a C1/C2) con un solo botón de “cerrar venta” en Cartera.
- Órdenes judiciales / reconcile con formularios ricos de hash (mínimo lab).
- App móvil / login eIDAS.
- Durable nonce (hoy el link de firma dura ~1 min por blockhash).
