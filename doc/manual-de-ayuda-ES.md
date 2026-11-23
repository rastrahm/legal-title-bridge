# Manual de ayuda — Legal Title Bridge

**Público:** operadores de laboratorio, verificadores, emisores y testers de la UI.  
**Entorno:** redes de prueba (Sepolia + Solana Devnet) o lab local. **Sin fondos reales.**  
**Companion:** [`casos-de-uso-ES.md`](./casos-de-uso-ES.md) · capturas en `doc/front-screenshots/` y `doc/qa-screenshots/`.

**En la app:** cada pantalla tiene el panel **«Ayuda de esta pantalla»** (colapsable) con el mismo contenido contextual (ES/EN). Este documento amplía el recorrido de laboratorio.

---

## 1. Antes de empezar

### 1.1 Qué es esto

Legal Title Bridge tokeniza un título (p. ej. lote de vino) en **Ethereum** y lo refleja en **Solana** (Token-2022). Ethereum decide; Solana espeja. La web **arma** transacciones y muestra estado; la verdad está en la cadena (D14).

### 1.2 Qué necesitás

| Pieza | Para qué |
|-------|----------|
| Navegador Chromium/Firefox reciente | UI Next.js |
| **MetaMask** | Ethereum: verificar, certificar, emitir, pausar, etc. |
| **Phantom** (2 cuentas lab) | Solana Devnet: vendedor (C1) y comprador (C2); Lab USD + título Token-2022 |
| ETH de Sepolia / SOL de Devnet | Solo testnet; faucets oficiales |
| Cuentas con rol | verifier, issuer, operator, guardian, court — según la acción |

### 1.3 Redes correctas

| Modo | Ethereum | Solana |
|------|----------|--------|
| Testnet lab | **Sepolia** (chainId `11155111`) | **Devnet** |
| UI Playwright / demo local | Anvil `31337` | genesis lab / stub |

Si la billetera **conectada** está en otra red, verás el banner rojo «Red incorrecta…» y no podrás firmar (W2).

### 1.4 Arrancar la web (lab)

```bash
cd frontend
nvm use 22
# .env.local: NEXT_PUBLIC_NETWORK_ID=sepolia-devnet  (o local)
npm run dev
# → http://localhost:3000
```

Idioma: conmutador **ES / EN** arriba a la derecha (no mezcla chrome crítico a mitad de flujo).

---

## 2. Mapa de pantallas

| Ruta | Nombre | Quién |
|------|--------|-------|
| `/` | Inicio | Todos — resumen I2 y accesos |
| `/activos` | Explorador | Público |
| `/activos/[assetId]` | Ficha del activo | Público |
| `/comprador` | Comprador | Cliente nuevo (Phantom → holder → KYC) |
| `/cartera` | Cartera | Titular / comprador (Phantom) |
| `/operador` | Operador | Emisor, operador, guardián, tribunal (MetaMask) |
| `/verificador` | Verificador | Verifier / certificadores (MetaMask) |
| `/puente` | Puente | Público — mensajes y semáforo I2 |

Capturas portfolio: `doc/front-screenshots/{home,activos,activo-detalle,cartera,operador,verificador,puente}.png`.

---

## 3. Verificador — identidad y certificación

**Casos:** UC-01, UC-02, UC-16 · Captura: `q-verificador.png`

### 3.1 Conectar

1. Andá a **Verificador**.
2. Pulsá **Conectar MetaMask**.
3. Elegí la cuenta con rol **verifier** (o certificador según el paso).
4. Comprobá que debajo del botón aparece tu dirección (no `—`).
5. Si el banner de red aparece: en MetaMask cambiá a Sepolia (o local) y reintentá.

### 3.2 Firmar identidad (paso a paso)

1. **Titular (identificador on-chain):** pegá el `bytes32` del holder (64 hex tras `0x`). En lab suele usarse el holder de demo `0xbbb…bbb`.
2. **País:** elegí del desplegable (p. ej. España → código `724` en la vista previa).
3. **Tipo de inversor:** Minorista u Institucional.
4. **Fecha de vencimiento:** usá el date picker; la UI muestra el unix resultante.
5. Revisá el recuadro **Vista previa** (país → código, fecha → timestamp).
6. Pulsá **Firmar identidad**.
7. En MetaMask: revisá el mensaje tipado EIP-712 (`LegalTitleBridge` / Assertion) y confirmá.
8. Esperá el hash de tx. En testnet: `registerAssertion` debe figurar en Etherscan Sepolia.

**Si el botón está gris:** falta algún campo → mensaje «Completa todos los campos…» ligado al control (`aria-describedby`). Completá y reintentá.

**Si MetaMask revierte `InvalidSignature`:** esa cuenta **no** es verifier on-chain. Cambiá de cuenta (no uses una EOA cualquiera).

### 3.3 Firmar certificación

1. Completá **Activo a certificar** (`assetId` bytes32, p. ej. `0xaaa…aaa`).
2. **Tipo de certificación:** Existencia del título / Estado registral.
3. Con la cuenta certificadora correcta, **Firmar certificación**.
4. Repetí con la segunda firma del quórum si el despliegue lo exige (hint en pantalla: issuer firma ambos tipos; operator repite).
5. Verificá en **Explorador → ficha del activo** que la certificación figura activa.

---

## 4. Operador — emitir y gobernanza

**Casos:** UC-03, UC-10, UC-11, UC-12, UC-15 · Capturas: `operador.png`, `q-operador.png`, `g1-happy.png`

### 4.1 Conectar y roles

1. **Operador** → **Conectar MetaMask**.
2. Usá la cuenta **issuer** para emitir; **guardian** para pausar; **court** para orden; **operator** para reconciliar.
3. Los botones ajenos a tu rol quedan deshabilitados con la idea «Tu cuenta no tiene este rol…».
4. (Solo lab) **Quitar roles (lab)** apaga todos los flags demo para probar el bloqueo.

### 4.2 Emitir (ciclo feliz Eth)

**Antes:** UC-01 + UC-02 hechos para ese holder/asset.

1. Completá:
   - **Asset id** (bytes32)
   - **Monto** (formulario; default lab `1000`)
   - **Destinatario** (holder bytes32, no address Eth cruda)
2. Pulsá **Emitir**.
3. Se abre **Confirmar transacción**:
   - Los valores mostrados se **decodifican de la tx a firmar**, no «del formulario a ciegas».
   - Si cambiás el monto del form **después** de armar la tx, el panel sigue mostrando lo que realmente se firmará (W4).
4. Revisá simulación OK si aparece.
5. **Firmar** en MetaMask.
6. Anotá el hash. En testnet debería haber `OutboundEmitted` / mensaje `ISSUE`.
7. Opcional: abrí **Puente** y mirá I2 (suministros Eth vs Sol).

**Errores frecuentes**

| Síntoma | Qué hacer |
|---------|-----------|
| Emitir gris | Conectá MetaMask, red correcta, rol issuer, y que no haya pausa / tx pendiente |
| Revert certificación | Completá UC-02 |
| Revert NotVerified | Completá UC-01 para ese holder |
| Doble clic confuso | Esperá; Emitir se deshabilita mientras hay `pendingTx` |

### 4.3 Pausar

1. Cuenta **guardian**.
2. **Pausar** → confirmar.
3. Comprobá que Emitir / inbound sensibles fallan hasta despausa (según diseño desplegado).

### 4.4 Orden judicial

1. Cuenta **courtExecutor**.
2. **Orden judicial** → confirmá el payload (incluye ancla / hash de resolución en el flujo real).
3. No uses hash vacío (revert).

### 4.5 Reconciliar D6

1. En **Puente**, si I2 está en rojo o hay alerta de divergencia tras fallo de relayers / Approved tardío:
2. Cuenta **operator** → **Reconciliar D6**.
3. Usá el `resolutionHash` del procedimiento documentado; no reenvíes el mismo hash dos veces.

---

## 5. Comprador — ingreso de cliente nuevo

**Caso:** UC-17 · Ruta: `/comprador`

1. Abrí **Comprador** (nav o Inicio).
2. **Conectar Phantom** (Devnet en testnet).
3. Copiá el **holder** (`bytes32`) o pulsá **Pedir verificación** (abre Verificador con el holder precargado).
4. El verificador firma KYC (UC-01) con *ese* holder.
5. **Actualizar estado** hasta ver «Verificado…».
6. **Confirmar ingreso** (solo marca la sesión UI; no crea roles).
7. Seguís a **Activos** o **Cartera**.

No hay alta de `BUYER_ROLE`: el comprador es una billetera + identidad opcional.

---

## 6. Cartera — venta y compra (DvP usable)

**Casos:** UC-05–UC-09 · Rutas: `/cartera` → `/cartera/vender` · `/cartera/comprar` · `/cartera/firmar`

La Cartera está pensada para **dos personas / dos PCs** (o dos cuentas Phantom). No hace falta estar en la misma habitación cambiando de cuenta a mitad de firma.

### 6.0 Qué mueve cadena y qué no

| Acción | ¿On-chain? | Quién |
|--------|------------|--------|
| Publicar lote | No (catálogo de la sesión) | Vendedor (C1) |
| Comprar (oferta) | No (intención) | Comprador (C2) |
| Aceptar oferta | Sí: approve + firma vendedor del `request_transfer` | C1 |
| Link → Firmar DvP | Sí: C2 firma y **escrow** título + Lab USD | C2 |
| Cobro final a C1 / título a C2 | Después: decisión Eth + settle | Operador / relayer |

**Lab USD** (`NEXT_PUBLIC_PAYMENT_MINT`) ≠ mint del título. C2 necesita saldo Lab USD; C1 necesita saldo del título Token-2022.

### 6.1 Preparar cuentas

1. Phantom → **Devnet** (no Mainnet).
2. **C1 (vendedor):** pubkey con unidades del mint título (p. ej. tras `apply_issue` / transferencia lab).
3. **C2 (comprador):** pubkey distinta, con Lab USD en su ATA Token-2022.
4. Usá la **misma pestaña del navegador** para publicar/ofertar (el catálogo vive en `sessionStorage` de esa pestaña). El **link de firma** sí se puede abrir en otro PC.

### 6.2 Conectar

1. `/cartera` → **Vender** o **Comprar**.
2. **Conectar Phantom** → debe verse la pubkey y el badge «Conectado».
3. Si sale «Red incorrecta», Phantom no está en Devnet (o el genesis no coincide).

### 6.3 C1 publica el lote

1. Phantom = **C1** → `/cartera/vender`.
2. Indicá cantidad (≤ saldo de título) → **Publicar**.
3. El lote queda en «Mis listados» y aparece en el catálogo de Comprar (misma pestaña).

### 6.4 C2 hace la oferta

1. Phantom = **C2** → `/cartera/comprar` (sin F5 si podés evitarlo; o publicá de nuevo si se borró el catálogo).
2. **Comprar** en el lote → aviso: oferta enviada. **Todavía no se mueve Lab USD.**
3. C1 ve la oferta en **Vender → Ofertas recibidas**.

### 6.5 C1 acepta y genera el link (firma vendedor)

1. Phantom = **C1** → **Aceptar oferta**.
2. Phantom pedirá firmar (approve del título; a veces avisa “retirar en el futuro” — en lab Devnet es el allowance al escrow). Confirmá solo en Devnet con cuentas de prueba.
3. Luego firma del vendedor sobre `request_transfer`.
4. Aparece el panel **Copiar link del comprador** → `/cartera/firmar#…`.
5. **Mandá ese link a C2** (chat, mail, etc.). Vigencia ~**1 minuto** (blockhash Solana). Si expiró, C1 vuelve a **Aceptar** y genera otro.

### 6.6 C2 firma y libera el pago al escrow

1. C2 abre el link en **su** PC (o la misma) con Phantom = **C2**.
2. **Conectar Phantom** si hace falta (debe ser exactamente la pubkey compradora del link).
3. **Firmar y enviar escrow**.
4. Ahí sí: Lab USD de C2 + título de C1 van al **escrow** on-chain. C1 **aún no cobra**; C2 **aún no** recibe el título libre — falta la decisión Eth / settle.

### 6.7 Cancelar

En ofertas Pending (antes del escrow cerrado), C1 puede **Cancelar** y reabrir el listado en la UI.

### 6.8 Plazos (concepto)

- **deadline:** hasta ahí Ethereum puede aprobar/rechazar.
- **hardDeadline = deadline + 7 días:** después, Solana puede reembolsar unilateralmente; un Approved tardío dispara reconciliación D6.

---

## 7. Explorador y puente

### 6.1 Explorador

**Caso:** UC-04 · Capturas: `activos.png`, `activo-detalle.png`

1. **Explorador** lista activos de demo / datos disponibles.
2. Entrá a un `assetId`.
3. Revisá:
   - Nombre / descripción
   - Certificaciones (activas / vencidas)
   - Holders
   - **Ledger:** «Cadena de asientos íntegra» o «rota en el asiento N» (recalculado en el navegador).
4. Si pegás un id inválido en la URL → mensaje de asset inválido.
5. Ruta inventada → **no encontrado**.

### 6.2 Puente

**Caso:** UC-13 · Captura: `puente.png`

1. Abrí **Puente**.
2. Semáforo I2: suministros cuadran (verde) o divergen (rojo).
3. Lista de mensajes y estados (visto / firmado / entregado…).
4. Estado del relayer: si dice no disponible, **reintentá luego**; la cadena sigue siendo la fuente de verdad — no es pantalla blanca.

---

## 8. Situaciones de error y recuperación

### 7.1 Red incorrecta (UC-14)

1. MetaMask en Mainnet (u otra) con app en Sepolia → banner + botones de firma off.
2. Cambiá a Sepolia → banner desaparece → volvé a conectar si hace falta.
3. Phantom: asegurate **Devnet** antes de conectar en Cartera.

### 7.2 Cuenta equivocada (UC-15)

1. Botones gris = sin rol en la demo / guard de UI.
2. Si firmás igual con clave sin permiso on-chain → revert (`InvalidSignature`, `Unauthorized`, etc.).
3. Solución: importá/seleccioná la cuenta de `secrets/roles/` correspondiente al lab (nunca en mainnet).

### 7.3 Relayer caído

1. Puente muestra copy accionable.
2. No inventes entregas; esperá o reiniciá el runner local de status (`relayer/scripts/run-relayer-status.mjs`) si estás en lab.

### 7.4 Cambio de cuenta a mitad de emisión

1. Si cambiás la cuenta de MetaMask con un borrador abierto, la UI **invalida el borrador** y avisa.
2. Volvé a pulsar Emitir con la cuenta correcta.

### 7.5 Recarga de página (catálogo)

Listados y ofertas de Cartera se guardan en **`sessionStorage` de la pestaña**. Un F5 en la misma pestaña los conserva; otra pestaña / otro perfil empieza vacío (hay que volver a publicar). Lo **on-chain** (escrow, saldos Token-2022) no depende del F5.

---

## 9. Recorrido recomendado (smoke humano)

Orden sugerido para un smoke de 15–20 min en testnet:

1. MetaMask Sepolia + cuenta verifier → UC-01 (`/verificador`).
2. Certificar asset → UC-02.
3. Cuenta issuer → UC-03 emitir; guardar hash.
4. `/puente` → mirar I2 / mensajes.
5. Phantom Devnet → `/cartera`: C1 publica → C2 oferta → C1 acepta + link → C2 `/cartera/firmar` (UC-05/06).
6. Probar a propósito Mainnet un momento → UC-14; volver a Sepolia.
7. Cuenta sin rol → intento de firma → UC-15.

Detalle de evidencia ya corrida: [`DEPLOY-TESTNET-ES.md`](./DEPLOY-TESTNET-ES.md).

---

## 10. Glosario rápido

| Término | Significado |
|---------|-------------|
| Holder | Identidad on-chain `bytes32` (no siempre = address Eth visible) |
| ISSUE | Mensaje Eth→Sol: acuñar espejo |
| DvP | Entrega contra pago (escrow Solana + decisión Eth) |
| I2 | Invariante: suministro Eth ≈ Sol |
| I7 | Cumplimiento: verificado + certificado + reglas |
| W2 | Guard de red de billetera |
| W4 | Confirmación desde calldata decodificado |
| D6 | Reconciliación tras Approved tardío / divergencia |
| EIP-712 | Firma tipada off-chain que el contrato recupera on-chain |

---

## 11. Dónde pedir más detalle técnico

| Tema | Doc |
|------|-----|
| Casos formales | [`casos-de-uso-ES.md`](./casos-de-uso-ES.md) |
| Secuencias y plazos | [`flujograma-ES.md`](./flujograma-ES.md) |
| Decisiones if/else | [`diagrama-de-flujo-ES.md`](./diagrama-de-flujo-ES.md) |
| Códec / MsgType | [`PROTOCOLO-ES.md`](./PROTOCOLO-ES.md) |
| Direcciones testnet | [`DEPLOY-TESTNET-ES.md`](./DEPLOY-TESTNET-ES.md) |
| Hallazgos UX | [`QA-ES.md`](./QA-ES.md) |
