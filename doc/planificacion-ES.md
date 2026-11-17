# Planificación — Módulo 22: Legal Title Bridge (Ethereum ↔ Solana)

**Estado:** planificación con hito inicial cerrado (16/11: docs de diseño ES + `hitos-ES.md`). Ninguna fase de código autorizada todavía.
**Regla de avance:** no se escribe código de una fase hasta: *"Autorizo Fase \<ID\>"*.
**Destino de la ruta:** ambas testnets — **Ethereum Sepolia** y **Solana Devnet** — con ciclo completo desde la interfaz, ataques rechazados con hashes de evidencia, y cierre solo cuando las dos redes hayan pasado el mismo checklist. Local (anvil + solana-test-validator) es el laboratorio; Sepolia + Devnet es el hito de aceptación pública de v1.
**Origen:** el artículo "Tokenizar sin reinventar la rueda: un puente Ethereum–Solana pensado desde el derecho europeo" (10/11/2026). Este módulo lo convierte en código que corre y se ataca.
**Advertencia:** laboratorio en redes locales y de prueba (Sepolia y Solana Devnet). No es un sistema en producción, no representa activos reales y no es asesoramiento legal.

---

## 1. Objetivo

Construir el diseño del artículo de punta a punta:

- **El título vive en Ethereum.** Un registro de títulos al estilo ERC-3643: titulares con identidad verificada, reglas de transferencia, certificaciones que vencen, asientos encadenados por hash y órdenes judiciales.
- **La representación vive en Solana.** Un mint Token-2022 cuyo transfer hook impide mover el token fuera del flujo autorizado, con un delegado permanente para órdenes judiciales.
- **Un puente de mensajes con quórum de relayers** (2 de 3 en v1) une las dos cadenas. Solo Ethereum es fuente de verdad: un movimiento en Solana no existe hasta que se inscribe en Ethereum.
- **Entrega contra pago en Solana.** El token del vendedor y el pago del comprador (un token de dinero electrónico simulado) quedan juntos en escrow y se liberan juntos o vuelven los dos.
- **Un frontend que muestra el sistema funcionando.** Cada actor tiene su vista (titular, comprador, operador, verificador) con la billetera de su cadena; el explorador público recalcula la cadena de asientos en el navegador; el monitor del puente muestra los mensajes en vuelo y si los suministros de las dos cadenas cuadran.
- **Una prueba de seguridad realista,** no supuesta. Se reproducen como ataques ejecutables los mecanismos de incidentes reales de puentes y programas (Poly Network, Qubit, Wormhole, Cashio, Ronin, Harmony y Nomad), sobre el código real desplegado en cadenas locales. Cada ataque se demuestra primero exitoso contra una variante vulnerable, para probar que el test ejercita el error de verdad.
- **Un set profundo de ataques ejecutado por otro agente** (fase EXTATK): catálogo independiente, en caja gris/negra, sin asumir conocimiento del árbol de tests del repo. Ese agente no escribe el código bajo prueba; solo ataca y reporta.
- **Un agente QA que simula un humano** (fase QA): recorre la interfaz y los flujos como titular, comprador, operador y verificador confusos, impacientes o novatos; no busca exploits, busca fallos de producto, UX y recuperabilidad.
- **Cierre en ambas testnets.** v1 no se da por cerrada hasta que Sepolia y Solana Devnet muestren el mismo ciclo y los mismos rechazos de ataque, con evidencia on-chain.

Clase de activo en v1: **vino en depósito fiscal** (lote intercambiable, custodio, cierre en especie). Las demás clases (terreno, casa, vehículo, pintura) quedan fuera de v1.

---

## 2. Alcance

| Incluido (v1) | Excluido (v1) |
|---------------|---------------|
| `TitleRegistry` en Ethereum: unidades por activo, titulares por clave de Solana, reglas de transferencia, estados y asientos encadenados por hash | Clases de activo distintas del vino |
| `IdentityRegistry` con afirmaciones firmadas por un verificador (EIP-712), con vencimiento | Integración con la cartera europea de identidad digital |
| `AttestationRegistry`: certificaciones de existencia y registral, con vencimiento y quórum para las críticas | Oráculos de valoración y de precio |
| `BridgeEndpoint` en Ethereum: quórum de relayers, anti-repetición por id de mensaje, límites de flujo, pausa de guardián, rotación de relayers con timelock | Clientes livianos (verificación por consenso de la otra cadena) |
| Programa Anchor `title_mirror`: mint Token-2022 con transfer hook y delegado permanente, verificación de quórum secp256k1 por introspección de instrucciones, escrow de entrega contra pago | Extensiones de comisión por transferencia y cuentas congeladas por defecto |
| Relayers en TypeScript (3 procesos, umbral 2), espera de finalidad, idempotencia en SQLite, reconciliador entre cadenas | Relayers en Rust (post-v1); red de mensajería comercial (Wormhole, CCIP, LayerZero) |
| Pruebas: unitarias, fuzz, invariantes, vectores dorados del códec, E2E local con fallas inducidas, red team con controles positivos, mutación dirigida, análisis estático | Auditoría externa; verificación formal |
| Despliegue en **Sepolia y Solana Devnet** (ambas obligatorias) con evidencia (hashes de transacción) de un ciclo completo y de ataques rechazados en las dos redes | Mainnet; activos o dinero reales; declarar v1 cerrada con solo una de las dos testnets |
| Frontend Next.js con dos billeteras (MetaMask para Ethereum, Phantom para Solana): vistas de titular/comprador, operador, verificador/certificador y explorador público con monitor del puente | App móvil; login con la cartera europea de identidad; frontend desplegado como servicio público permanente |
| Docs ES/EN, diagramas, SWC-AUDIT, GAS, portfolio | — |

---

## 3. Stack y restricciones técnicas

### Suite (`evm-smart-contracts-suite` + `solidity.cursorrules`)

- Solidity **exacto** `0.8.37`, EVM Cancun. OpenZeppelin Contracts v5.x (`EIP712`, `ECDSA`, `AccessControl`, `TimelockController`, `ReentrancyGuardTransient`, `SafeERC20`).
- Foundry: unit + fuzz (`runs >= 1000`) + invariant (`runs >= 256`, `depth >= 50`; perfil `heavy`: `depth = 100`, `runs = 512`) + gas.
- Custom errors; CEI estricto; NatSpec en toda API pública/externa; layout Interfaces → Libraries → Contracts → State → Events → Errors → Modifiers → Functions.
- TDD: en cada fase de contratos, los tests primero.
- Linter de contratos integrado al flujo (OWASP SCSVS/SCSTG, capítulo 0x06): `forge fmt --check` y `forge lint` en `make check` y en el hook de pre-commit. Cada excepción va en la línea, con `// forge-lint: disable-next-line(<id>)` y el motivo al lado.

### Solana (`solana.cursorrules`)

- Anchor **0.31.1**, `anchor-spl` 0.31 con features `token_2022` y `token_2022_extensions`; Solana CLI 2.2.20.
- Toda cuenta validada por tipo o restricción. `UncheckedAccount` solo con `/// CHECK:` justificado y con un test que intente sustituirla.
- Sysvar de instrucciones leído **solo** con `load_instruction_at_checked` y con `address = sysvar::instructions::ID`.
- `cargo clippy -- -D warnings` limpio.

### Relayer

- TypeScript sobre Node 22 (`nvm use 22`), `ethers` v6 (Ethereum, igual que los frontends de la suite) y `@coral-xyz/anchor` / `@solana/web3.js` (Solana), `better-sqlite3`, `vitest`.
- Cada relayer tiene su propia clave secp256k1. La **misma** dirección Ethereum lo identifica en las dos cadenas.
- Expone una API HTTP **solo de lectura** (`/status`, `/messages`) para el monitor del frontend. Nunca recibe órdenes por HTTP.

### Paquete compartido (`shared/`)

- Códec, ABIs, IDL de Anchor, direcciones e ids de programa por red, validados con Zod. Lo usan el relayer, el E2E y el frontend, así que hay una sola definición del mensaje en TypeScript.

### Frontend (`nextjs.cursorrules`, mismo stack que `solana-escrow-anchor/frontend`)

- Next.js 16 (App Router), React 19, TypeScript estricto (cero `any`), Tailwind 4, Zod, Node 22.
- Ethereum: `ethers` v6 con MetaMask (EIP-1193). Solana: `@solana/wallet-adapter-react` con Phantom, `@coral-xyz/anchor`, `@solana/spl-token`.
- Vitest + React Testing Library (TDD por componente; búsqueda por rol). Playwright para E2E de navegador contra el stack local.
- `'use client'` / `'use server'` explícitos; JSDoc por componente y hook; `error.tsx` y `not-found.tsx` por ruta.
- Idioma ES/EN con el mismo patrón `i18n` del portfolio.

### Herramientas a instalar en BOOT (hoy no están)

- `slither` (`pipx install slither-analyzer`) y `aderyn` (`cyfrinup` o `cargo install aderyn`).
- `cargo-audit` (`cargo install cargo-audit`).
- Playwright con Chromium (`npx playwright install chromium`, dentro de `frontend/`).

---

## 4. Decisiones de diseño (cerradas antes de codear)

| # | Decisión | Por qué |
|---|----------|---------|
| D1 | **Ethereum manda.** Solana solo cambia saldos por mensajes aprobados en Ethereum (emisión, decisión de transferencia, orden judicial). | Es el modelo de registro único de la eWpG y la Ley 6/2023 |
| D2 | **Los titulares se identifican en Ethereum por su clave pública de Solana** (`bytes32`), ligada a una identidad en `IdentityRegistry`. | El token se mueve en Solana; el registro tiene que saber de quién es cada cuenta |
| D3 | **Entrega contra pago completa en Solana.** El escrow guarda los dos tramos (token y pago); Ethereum decide. | La liquidación queda atómica en una sola cadena; el puente solo lleva la decisión |
| D4 | **Ethereum aprueba solo antes del `deadline`** (con su propio reloj). Pasado el plazo, marca la solicitud `Expired` y emite esa decisión. | Evita aprobar algo que Solana ya no espera |
| D5 | **Solana no reembolsa por su cuenta antes de un `hardDeadline`** (`deadline + 7 días`). Hasta ahí, solo reembolsa con una decisión `Rejected` o `Expired` firmada. | Sin esto, un reembolso local y una aprobación tardía producen dos verdades |
| D6 | **Riesgo residual declarado:** una aprobación que llega después del `hardDeadline` es rechazada por Solana. El reconciliador detecta la divergencia y el operador la corrige en Ethereum con una transferencia de reconciliación, con el hash de la resolución. Se prueba en E2E. | Es la pregunta de PwC: qué pasa si falla el puente. Se responde con un procedimiento probado, no con una promesa |
| D7 | **Ningún mensaje entre cadenas puede cambiar relayers, umbral, roles ni código.** Cada cadena gobierna lo suyo localmente, con timelock. | Lección de Poly Network |
| D8 | **Mensajes tipados, no llamadas arbitrarias.** `MsgType` es un enum cerrado; el endpoint despacha a funciones fijas. | Lección de Poly Network |
| D9 | **El estado por defecto de un mensaje es "desconocido".** Aprobado es un valor explícito que solo se escribe tras verificar el quórum. | Lección de Nomad |
| D10 | **Umbral de relayers ≥ ⌈2n/3⌉ y n ≥ 3,** validado en el despliegue y en cada rotación. | Lección de Harmony (2 de 5) |
| D11 | **El digest firmado incluye versión, cadena de origen, cadena de destino, emisor (dirección del endpoint o id del programa) y época del set de relayers.** | Evita repetir un mensaje en otro despliegue, otra cadena u otro set |
| D12 | **Límites de flujo por activo** (unidades por ventana de 24 h y máximo por transferencia), más una pausa de guardián. | Acota la pérdida si se compromete el quórum (Ronin) |
| D13 | **Separación de roles:** emisor, verificador, certificador, operador del registro, ejecutor judicial y guardián son claves distintas, y el despliegue lo comprueba. | Es la separación de roles del artículo |
| D14 | **El frontend no es fuente de verdad ni guarda claves.** Todo lo que muestra lo lee de las cadenas (o de la API de lectura del relayer, marcada como tal); toda acción la firma la billetera del usuario; todo lo que hace la interfaz también se puede hacer con scripts. Las direcciones e ids de programa salen de `shared/` por red, nunca de la URL. | Si el frontend cae o lo comprometen, el registro sigue intacto y el daño queda en engañar al usuario, que se mitiga con §10.6 |

---

## 5. Modelo de amenazas

| Actor | Qué puede hacer | Qué no debería poder hacer |
|-------|-----------------|----------------------------|
| Atacante externo | Leer todo; mandar cualquier transacción; repetir mensajes y firmas públicas; desplegar programas y contratos propios; pasar cuentas falsas | Mover tokens, emitir sin certificación, aprobar transferencias |
| Titular malicioso | Pedir transferencias; cancelar; pasar cuentas propias | Transferir por fuera del escrow; vender a alguien sin identidad verificada; cobrar dos veces |
| Comprador malicioso | Bloquear el pago; dejar vencer; reentrar desde un token con callback | Quedarse con el token sin pagar o con el pago y el token |
| Relayers comprometidos, k < umbral | Firmar lo que quieran | Hacer pasar un mensaje |
| Relayers comprometidos, k ≥ umbral | Hacer pasar mensajes falsos | Sacar más que el límite de flujo en la ventana; seguir después de la pausa del guardián |
| Relayer caído o lento | No entregar; entregar dos veces; entregar fuera de orden | Romper la idempotencia o el estado terminal único |
| Reorganización de Ethereum | Revertir el bloque de un evento ya visto | Que el relayer lo haya entregado antes de la finalidad |
| Clave del operador comprometida | Actuar como operador | Cambiar relayers o reglas sin pasar por el timelock |
| Emisor con metadatos maliciosos | Poner en cadena nombres o descripciones de activo con HTML o scripts | Ejecutar código en el navegador de otro usuario (XSS) |
| Sitio clonado o frontend alterado | Mostrar montos o destinatarios falsos y pedir firmas | Que el usuario firme a ciegas: la interfaz decodifica y simula la transacción antes de pedir la firma, y la billetera muestra los datos tipados |
| Emisor que miente sobre el bien | Mentir en el mundo físico | (fuera del código: es el riesgo del activo del artículo; el sistema solo obliga a una certificación firmada y con nombre) |

---

## 6. Arquitectura (objetivo de v1)

```
22-legal-title-bridge/
├── README.md / README-ES.md / README-EN.md
├── .cursorrules
├── .env.example
├── foundry.toml
├── remappings.txt
├── Makefile                      # make check = todas las comprobaciones de §9
├── doc/                          # cada documento en -ES.md y -EN.md
│   ├── planificacion-ES/EN.md
│   ├── hitos-ES.md               # tablero para marcar fases y criterios de salida
│   ├── PROTOCOLO-ES/EN.md        # formato de mensaje, estados, plazos
│   ├── RED-TEAM-ES/EN.md         # incidentes, controles positivos, resultados
│   ├── QA-ES/EN.md               # agente QA humano simulado: personas, guiones, hallazgos
│   ├── EXTATK-ES/EN.md           # set profundo X1–X36 por agente atacante externo
│   ├── diagrama-de-clases-ES.md  # UML contratos / programa / relayer / frontend
│   ├── diagrama-de-flujo-ES.md   # decisiones por operación (issue, DvP, quórum, hook…)
│   ├── flujograma-ES.md          # ciclo de vida, fases, plazos, testnets
│   ├── mapa-de-ataques-ES.md     # R/P/F/W/M/X → controles e invariantes
│   ├── superficie-de-ataques-ES.md # entradas, fronteras de confianza, roles
│   ├── SWC-AUDIT-ES/EN.md
│   ├── GAS-ES/EN.md
│   └── DEPLOY-TESTNET-ES/EN.md   # Sepolia + Devnet: direcciones y hashes de evidencia
├── src/                          # Ethereum
│   ├── TitleRegistry.sol
│   ├── IdentityRegistry.sol
│   ├── AttestationRegistry.sol
│   ├── BridgeEndpoint.sol
│   ├── compliance/ (CountryModule, MaxHoldersModule, LockupModule)
│   ├── libraries/ (PacketCodec, RelayerQuorum, MessageIdSet, FlowLimiter, LedgerChain)
│   ├── interfaces/ · errors/ · mocks/
├── test/
│   ├── unit/ · fuzz/ · invariant/ · gas/
│   ├── vectors/packets.json      # vectores dorados del códec
│   └── redteam/
│       ├── vulnerable/           # variantes vulnerables (controles positivos), solo en test
│       └── *.t.sol
├── script/ (Deploy.s.sol, GenVectors.s.sol)
├── solana/                       # workspace Anchor
│   ├── programs/title_mirror/src/{lib.rs, state/, instructions/, codec.rs, quorum.rs, hook.rs}
│   ├── tests/ (*.ts)
│   └── Cargo.toml                # feature `redteam-*` para las variantes vulnerables
├── shared/                       # TypeScript: códec, ABIs, IDL, direcciones por red (Zod)
├── relayer/                      # TypeScript
│   ├── src/{watcher-eth, watcher-sol, signer, submitter, store, reconciler, status-api}.ts
│   └── test/
├── frontend/                     # Next.js 16
│   ├── src/app/
│   │   ├── page.tsx              # inicio: qué es, red activa, estado del puente
│   │   ├── activos/[assetId]/    # explorador público: ficha, titulares, historial verificado
│   │   ├── cartera/              # titular/comprador: saldos, vender, comprar, mis solicitudes
│   │   ├── operador/             # emisión, orden judicial, reconciliación, pausa
│   │   ├── verificador/          # identidades y certificaciones (firma EIP-712)
│   │   └── puente/               # monitor: mensajes en vuelo, relayers, conciliación I2
│   ├── src/{components, hooks, lib}/
│   ├── test/                     # Vitest + Testing Library
│   └── e2e/                      # Playwright contra el stack local
├── e2e/
│   ├── stack.sh                  # anvil + solana-test-validator + despliegue + 3 relayers
│   └── scenarios/*.test.ts
└── portfolio/
```

### Contratos y programa

| Artefacto | Responsabilidad |
|-----------|-----------------|
| `TitleRegistry` | Unidades por activo y titular (`bytes32`), reglas de transferencia, estados (`Active`, `Paused`, `Frozen`), solicitudes de transferencia y su decisión, emisión, orden judicial, reconciliación, asientos encadenados (`entryHash = keccak256(prevHash, datos)`) |
| `IdentityRegistry` | Afirmaciones del verificador (país, tipo de inversor, vencimiento) por clave de Solana, firmadas EIP-712 |
| `AttestationRegistry` | Certificaciones de existencia y registral por activo, con vencimiento; quórum para la emisión |
| `BridgeEndpoint` | Verifica el quórum, marca el id de mensaje, aplica límites, despacha por `MsgType` y emite mensajes de salida con secuencia |
| `title_mirror` (Anchor) | Config, set de relayers (direcciones Ethereum), verificación de quórum, mint Token-2022, hook, escrow de entrega contra pago, delegado permanente |
| Relayer | Observa las dos cadenas, espera la finalidad, firma, junta firmas, entrega, guarda el estado de forma idempotente y reconcilia |
| Frontend | Muestra el estado de las dos cadenas y arma transacciones para que las firme la billetera del usuario, según su rol |

### Vistas del frontend

| Vista | Quién | Billetera | Qué hace |
|-------|-------|-----------|----------|
| Explorador (`/activos/[assetId]`) | Cualquiera, sin conectar | — | Ficha del lote de vino, certificaciones vigentes y vencidas, titulares, historial de asientos **recalculando la cadena de hashes en el navegador** (muestra si cuadra o en qué asiento se rompe) |
| Cartera (`/cartera`) | Titular y comprador | Phantom | Saldos; vender (crea la solicitud: token al escrow); comprar (deposita el pago en el escrow); seguimiento con cuenta regresiva hasta el `deadline` y el `hardDeadline`; reembolso cuando corresponde |
| Operador (`/operador`) | Emisor, operador, ejecutor judicial, guardián | MetaMask | Emitir (solo si hay certificaciones vigentes); orden judicial con hash de la resolución; reconciliación D6; pausa. Cada botón se habilita según el rol que tiene la cuenta conectada en el contrato |
| Verificador (`/verificador`) | Verificador y certificadores | MetaMask | Firmar identidades y certificaciones EIP-712 mostrando los campos legibles; ver vencimientos próximos |
| Puente (`/puente`) | Cualquiera | — | Mensajes por estado (visto, finalizado, firmado, entregado), relayers activos, límites de flujo consumidos, suministro Ethereum vs. Solana (I2) en verde o rojo |

### Tipos de mensaje (enum cerrado)

| `MsgType` | Sentido | Efecto |
|-----------|---------|--------|
| `ISSUE` | Ethereum → Solana | Acuñar N tokens al emisor, igual a las unidades emitidas en el registro |
| `TRANSFER_REQUEST` | Solana → Ethereum | Registrar una solicitud con vendedor, comprador, cantidad, precio, mint del pago, `deadline` y hash de datos de la regla de viaje |
| `TRANSFER_DECISION` | Ethereum → Solana | `Approved`, `Rejected(motivo)` o `Expired` |
| `FORCED_TRANSFER` | Ethereum → Solana | Mover con el delegado permanente, con el hash de la resolución judicial |

---

## 7. Errores custom (Ethereum, propuestos)

```solidity
error NotVerified(bytes32 holder);
error TransferNotCompliant(uint8 rule);
error CertificationExpired(bytes32 assetId);
error AssetFrozen(bytes32 assetId);
error UnknownMessage();
error MessageAlreadyProcessed(bytes32 messageId);
error InvalidQuorum();
error WrongDomain();           // versión, cadena, emisor o época incorrectos
error UnsupportedMsgType(uint8 t);
error RequestNotPending(bytes32 transferId);
error DeadlinePassed(bytes32 transferId);
error FlowLimitExceeded(bytes32 assetId);
error ThresholdTooLow();       // < ceil(2n/3)
error RoleOverlap(bytes32 roleA, bytes32 roleB);
error EmptyCode(address target);
error ZeroAddress();
error Unauthorized();
```

---

## 8. Invariantes

| ID | Invariante | Dónde se comprueba |
|----|-----------|--------------------|
| I1 | Por activo: suma de saldos del registro = unidades emitidas − rescatadas | Foundry invariant |
| I2 | Por activo: suministro del mint en Solana = unidades del registro en Ethereum | Reconciliador, después de cada escenario E2E |
| I3 | Cada id de mensaje se aplica como máximo una vez, en cada cadena | Foundry invariant + test Anchor + E2E con entrega duplicada |
| I4 | Cada solicitud termina en un solo estado: `Completed` o `Refunded` (nunca los dos, nunca vuelve a `Pending`) | Foundry invariant + test Anchor + E2E |
| I5 | Ningún token de Solana cambia de dueño fuera de: escrow, liberación por decisión o delegado permanente por orden | Test del hook con todos los caminos de transferencia |
| I6 | El pago se conserva: termina en el vendedor o vuelve al comprador | Test Anchor + E2E |
| I7 | Nunca se aprueba con una certificación vencida ni a un titular sin identidad vigente | Foundry fuzz + invariant |
| I8 | Umbral ≥ ⌈2n/3⌉ y n ≥ 3 en todo momento | Foundry invariant sobre las rotaciones |
| I9 | La cadena de asientos es continua: cada `entryHash` encadena con el anterior | Foundry invariant |

---

## 9. Comprobaciones (qué se corre y qué tiene que dar)

`make check` corre todo en este orden y falla en el primer error:

| # | Comprobación | Comando | Criterio |
|---|--------------|---------|----------|
| C0 | Formato y linter | `forge fmt --check` + `forge lint src test script` (con `scripts/lint.sh`) | Cero hallazgos de cualquier severidad, salvo excepciones en línea con motivo. `forge lint` sale con código 0 aunque encuentre problemas, así que `scripts/lint.sh` falla si la salida contiene `error[`, `warning[` o `note[` |
| C1 | Compila Ethereum | `forge build` | Sin warnings |
| C2 | Tests Ethereum | `forge test` | Todos verdes, incluidos fuzz e invariantes |
| C3 | Cobertura | `forge coverage --report summary --no-match-coverage "(test\|script\|mocks)"` | ≥ 90 % de líneas y ≥ 85 % de ramas en `src/` |
| C4 | Análisis estático | `slither . --exclude-dependencies` y `aderyn .` | Cero hallazgos High/Medium sin justificar en `SWC-AUDIT` |
| C5 | Vectores dorados | `forge script script/GenVectors.s.sol` + `cargo test -p title_mirror codec` + `vitest run codec` | Los tres lenguajes producen los mismos bytes y el mismo hash para cada vector |
| C6 | Compila Solana | `anchor build` + `cargo clippy -- -D warnings` | Sin warnings |
| C7 | Tests Solana | `anchor test` | Todos verdes |
| C8 | Dependencias | `cargo audit` y `npm audit --omit=dev` | Sin vulnerabilidades High sin justificar |
| C9 | Relayer | `vitest run` en `relayer/` | Todos verdes |
| C10 | E2E local | `e2e/stack.sh && vitest run e2e/` | Todos los escenarios de §10.2 verdes; reconciliador sin divergencias (salvo el escenario D6, donde la divergencia se espera y se corrige) |
| C11 | Red team | `forge test --match-path "test/redteam/*"` + `anchor test -- --features redteam` + `vitest run e2e/redteam` | Cada ataque: **éxito** contra su variante vulnerable y **fallo** con el error esperado contra el código real |
| C12 | Mutación dirigida | `scripts/mutate.sh` | Cada mutante de §10.4 hace fallar al menos un test |
| C13 | Gas | `forge snapshot --check` | Sin regresiones mayores al 5 % sin explicar |
| C14 | Frontend estático | `npm run lint && npx tsc --noEmit && npm run build` en `frontend/` | Sin errores ni warnings; cero `any` |
| C15 | Frontend unitario | `npm test` en `frontend/` | Todos verdes; cobertura ≥ 80 % en `src/lib` y `src/hooks` |
| C16 | Frontend E2E | `npx playwright test` contra el stack de C10 | Los recorridos de la fase FRONT y los ataques W1–W6 de §10.6 verdes |
| C17 | Build sin código de test | `scripts/check-bundle.sh` | El bundle de producción no contiene el adaptador de billetera de prueba, claves ni URLs de anvil/localhost |

---

## 10. Prueba de seguridad realista

### 10.1 Reglas para que no sea un supuesto

1. **Código real.** Los ataques se ejecutan contra los contratos y el programa desplegados, en el EVM de Foundry o en cadenas locales (anvil y solana-test-validator). Nunca se simula el componente que se defiende.
2. **Control positivo obligatorio.** Cada ataque se corre primero contra una variante vulnerable que reproduce el error original (en `test/redteam/vulnerable/` o con una feature `redteam-*` del programa). Si el ataque no tiene éxito contra la variante vulnerable, el test no prueba nada y se rehace.
3. **Capacidades explícitas.** Cada test declara qué tiene el atacante: solo información pública, k claves de relayer, la clave del operador, etc.
4. **Pérdida medida.** En los escenarios de compromiso de quórum, el test mide cuánto sacó el atacante y lo compara con la cota de diseño (límite de flujo).
5. **Evidencia.** El resultado queda en `doc/RED-TEAM-ES.md`: incidente, causa raíz, control, archivo de test, resultado contra la variante vulnerable y contra el código real. En testnet, con hashes de transacción.

### 10.2 Incidentes reales reproducidos

| # | Incidente | Causa raíz documentada | Ataque que se ejecuta | Control en este diseño | Resultado esperado |
|---|-----------|------------------------|-----------------------|------------------------|--------------------|
| R1 | **Poly Network** (ago. 2021, ~611 M USD) | El administrador de mensajes podía llamar a cualquier contrato; un selector fabricado alcanzó la función que cambiaba las claves del guardián | Mensaje entre cadenas con un payload que apunta a funciones de administración (cambiar relayers, roles, umbral) y con selectores arbitrarios | D7 y D8: enum cerrado; ningún mensaje toca la gobernanza | `UnsupportedMsgType`; set de relayers sin cambios |
| R2 | **Qubit** (ene. 2022, ~80 M USD) | Un depósito con un token en la dirección cero: la transferencia "funcionó" porque no había código, y se acuñó en la otra cadena | Configurar o pasar como token de pago o de título una dirección sin código; en Solana, un mint del pago que no es el declarado | `SafeERC20` / chequeo de `code.length`; en Solana, restricciones `address` y `token::mint` | `EmptyCode` / error de restricción de Anchor |
| R3 | **Wormhole** (feb. 2022, ~120.000 wETH, ~320 M USD) | Verificación de firmas en Solana con `load_instruction_at` sin comprobar la dirección del sysvar: el atacante pasó un sysvar falso | Llamar a la verificación de quórum con una cuenta falsa en lugar del sysvar de instrucciones, que dice que las firmas secp256k1 fueron verificadas | `address = sysvar::instructions::ID` + `load_instruction_at_checked`; se verifica que la instrucción secp256k1 corresponda al mensaje y a las direcciones del set | Error de restricción; nada se acuña |
| R4 | **Cashio** (mar. 2022, ~48 M USD) | Faltaba validar el mint de una cuenta de garantía: el atacante armó una cadena de cuentas falsas con el mismo formato | Pasar un mint, una token account, una cuenta de config o un escrow falsos, con el mismo layout, creados por un programa del atacante | Restricciones `owner`, `seeds`, `has_one`, `token::mint`, `token::authority`; discriminadores de Anchor | Error de restricción en cada sustitución |
| R5 | **Ronin** (mar. 2022, ~625 M USD) | 5 de 9 claves de validadores comprometidas; una autorización vieja nunca revocada | (a) Firmar con k = umbral − 1 claves. (b) Firmar con un relayer ya removido. (c) Con k = umbral claves: intentar vaciar un activo | (a) quórum; (b) época en el digest (D11); (c) límite de flujo + pausa del guardián (D12) | (a) y (b) `InvalidQuorum` / `WrongDomain`; (c) pérdida ≤ límite de la ventana y cero después de la pausa |
| R6 | **Harmony Horizon** (jun. 2022, ~100 M USD) | Multifirma de 2 de 5 | Desplegar o rotar a un umbral bajo | D10 | `ThresholdTooLow` en el despliegue y en la rotación |
| R7 | **Nomad** (ago. 2022, ~190 M USD) | Una actualización dejó la raíz confiable en cero: todo mensaje no probado pasaba como válido | Procesar un mensaje nunca visto con campos en cero, o cuyo estado por defecto se lea como aprobado | D9: el estado por defecto es "desconocido"; aprobado solo tras el quórum | `UnknownMessage` / `InvalidQuorum` |

### 10.3 Ataques del protocolo propio

| # | Ataque | Control | Resultado esperado |
|---|--------|---------|--------------------|
| P1 | Repetir un mensaje ya procesado, en la misma cadena | Conjunto de ids de mensaje | `MessageAlreadyProcessed` |
| P2 | Repetir un mensaje firmado en otro despliegue, otra cadena u otra época | Dominio en el digest (D11) | `WrongDomain` |
| P3 | Transferir el token de Solana de titular a titular por fuera del escrow (`transfer_checked` directo, con delegado, desde otro programa) | Transfer hook | El hook rechaza todos los caminos no autorizados |
| P4 | Carrera entre reembolso y aprobación tardía | D4, D5 y D6 | Estado terminal único en cada cadena; la divergencia D6 se detecta y se corrige |
| P5 | Reentrada desde un token de pago con callback (variante del pago en Ethereum para el tramo de prueba) | CEI + `ReentrancyGuardTransient` | Revert; saldos intactos |
| P6 | Vender a un comprador sin identidad vigente o con certificación vencida | `IdentityRegistry` + `AttestationRegistry` | `Rejected(NotVerified)` / `Rejected(CertificationExpired)` en la decisión |
| P7 | Orden judicial sobre tokens que están en escrow | La orden cancela la solicitud pendiente y después mueve | Escrow reembolsado al comprador; token al destinatario de la orden |
| P8 | Mensaje con montos fuera de rango (cero, desbordamiento, más unidades que el saldo) | Validación en el códec y en el registro | Revert con el error específico |
| P9 | Front-running del `refund` después del `hardDeadline` por un tercero | El reembolso solo paga a los dueños originales | El tercero no gana nada |

### 10.4 Mutación dirigida

`scripts/mutate.sh` aplica cada mutante sobre una copia del código, corre los tests y exige que **alguno falle**. Si todos pasan con el control quitado, falta un test.

| Mutante | Qué quita |
|---------|-----------|
| M1 | Marcar el id de mensaje como procesado |
| M2 | Incluir la época en el digest |
| M3 | Comprobar el `deadline` en la aprobación |
| M4 | Comprobar la vigencia de la certificación |
| M5 | Comprobar la identidad del comprador |
| M6 | El límite de flujo |
| M7 | La validación `>= ⌈2n/3⌉` del umbral |
| M8 (Solana) | La restricción `address` del sysvar de instrucciones |
| M9 (Solana) | La restricción `token::mint` del pago |
| M10 (Solana) | La comprobación del dueño en el hook |

### 10.5 Fallas inducidas en E2E

| # | Falla | Qué se mide |
|---|-------|-------------|
| F1 | Matar un relayer en medio de una entrega y reiniciarlo | El mensaje se entrega una sola vez; I3 se mantiene |
| F2 | Dos relayers entregan el mismo mensaje a la vez | Uno pasa y el otro recibe `MessageAlreadyProcessed`; sin efectos dobles |
| F3 | Entregas fuera de orden (la decisión antes que la emisión) | La entrega prematura falla sin efectos y pasa al reintentarla en orden |
| F4 | Relayers apagados más allá del `deadline` y del `hardDeadline` | D5 y D6: reembolso unilateral, divergencia detectada y reconciliación aplicada |
| F5 | Reorganización en anvil (`evm_snapshot` / `evm_revert`) después de un evento | El relayer no entregó antes de la confirmación configurada; nada se aplica en Solana |

### 10.6 Ataques al frontend (Playwright, contra el stack local)

Las mismas reglas de §10.1: navegador real, stack real y, cuando aplica, control positivo con una variante vulnerable del componente (`frontend/e2e/vulnerable/`, nunca incluida en el build).

| # | Ataque | Control | Resultado esperado |
|---|--------|---------|--------------------|
| W1 | XSS: el emisor registra un activo con nombre `<img src=x onerror=...>` y descripción con `javascript:` en un enlace | React escapa por defecto; prohibido `dangerouslySetInnerHTML` (regla de lint); enlaces solo `https:` validados con Zod; CSP sin `unsafe-inline` para scripts | La variante vulnerable ejecuta el script (control positivo); la real muestra el texto literal y la consola no registra ejecución |
| W2 | Red equivocada: billetera en mainnet u otra cadena / cluster | Comprobación de `chainId` y genesis hash de Solana antes de armar cualquier transacción | Botones deshabilitados con aviso; ninguna solicitud de firma |
| W3 | Dirección inyectada por URL (`?endpoint=0xATACANTE`, `?program=...`) | D14: direcciones solo desde `shared/` | El parámetro se ignora; la transacción va al contrato configurado |
| W4 | Interfaz que miente: se altera en el DOM el monto o el destinatario mostrado antes de firmar | La pantalla de confirmación se arma **decodificando la transacción que se va a firmar** (no el formulario) y simulándola (`eth_call` / `simulateTransaction`) | Lo mostrado coincide con lo firmado; la manipulación del formulario no cambia la transacción |
| W5 | Clickjacking: el sitio embebido en un iframe ajeno | `frame-ancestors 'none'` y `X-Frame-Options: DENY` | El navegador se niega a embeberlo |
| W6 | API del relayer comprometida: devuelve mensajes y estados falsos | La interfaz marca esos datos como "informados por el relayer"; saldos, titularidad y estados de solicitud se leen siempre de las cadenas | Los datos falsos no cambian lo que la vista muestra como titularidad ni habilitan acciones |

La billetera de prueba de Playwright (clave de anvil y keypair local) solo existe con `NEXT_PUBLIC_E2E=1`; C17 verifica que no llegue al build de producción.

### 10.7 Set profundo de ataques — ejecución por otro agente (EXTATK)

Este catálogo **no** lo ejecuta el agente que escribe el módulo. Lo ejecuta un **agente atacante separado**, con brief propio, contra el stack local primero y, tras autorizar TESTNET, contra Sepolia + Devnet.

**Reglas del agente atacante**

| Regla | Detalle |
|-------|---------|
| Independencia | No lee `test/redteam/` ni adapta el ataque al assert del test; parte del ABI/IDL públicos, del PROTOCOLO y de lo observable on-chain |
| Capacidades declaradas | Cada ítem fija el presupuesto del atacante (solo público; 1 clave de relayer; k = umbral − 1; k = umbral; operador; emisor; frontend clonado) |
| Evidencia | Por cada ítem: pasos, transacciones, error o efecto observado, y veredicto `bloqueado` / `parcial` / `roto` |
| Controles positivos ajenos | Si el código real resiste, el atacante no exige variantes vulnerables; eso ya lo cubre REDTEAM. Aquí se busca lo que REDTEAM no imaginó |
| Prohibido | Mainnet; fondos reales; phishing a terceros; DoS a RPC públicos de terceros más allá de lo necesario para un intento acotado |

**Entrega:** `doc/EXTATK-ES.md` (y EN) con la tabla de resultados; los hallazgos `parcial`/`roto` bloquean el avance a SOLV hasta corrección o justificación aceptada.

#### A — Puente y quórum

| ID | Ataque | Capacidad | Qué busca |
|----|--------|-----------|-----------|
| X1 | Reenviar un paquete firmado con `srcChain`/`dstChain` intercambiados | Firmas públicas ya emitidas | Que el dominio del digest no se compruebe en un sentido |
| X2 | Mutilar un solo byte del payload tras firmar y reenviar con las mismas firmas | Firmas públicas | Que el hash del mensaje no ate el payload |
| X3 | Entregar el mismo `messageId` en la cadena destino con otro `MsgType` empaquetado | Firmas + mempool | Colisión o acoplamiento débil id ↔ tipo |
| X4 | Rotar relayers en Ethereum y usar firmas de la época anterior en Solana (y al revés) | 1 relayer removido + firmas viejas | Época no sincronizada entre cadenas |
| X5 | Con k = umbral − 1, inundar el endpoint con firmas casi-válidas y una basura | k − 1 claves | Aceptación por conteo mal hecho o firmas duplicadas contadas dos veces |
| X6 | Dos conjuntos de firmas distintos para el mismo mensaje, entregados en paralelo | k = umbral en dos coaliciones | Doble efecto o estado inconsistente |
| X7 | Mensaje `ISSUE` con cantidad que supera el límite de flujo pero troceado en N mensajes bajo el tope | k = umbral | Evasión de ventana 24 h por fragmentación |
| X8 | Pausar en Ethereum y seguir firmando emisiones hacia Solana (y al revés) | Guardián + k = umbral | Pausa no simétrica entre extremos |

#### B — Registro, identidad y certificaciones

| ID | Ataque | Capacidad | Qué busca |
|----|--------|-----------|-----------|
| X9 | Afirmación EIP-712 con `chainId` o `verifyingContract` de otro despliegue | Clave de verificador de un fork/local | Reuso de firmas entre entornos |
| X10 | Certificación que vence entre la decisión en Ethereum y la liberación en Solana | Reloj + certificador | Ventana donde I7 se rompe en una sola punta |
| X11 | Comprador verificado que pierde la identidad (revocación) tras `TRANSFER_REQUEST` y antes de la decisión | Verificador + comprador | Decisión que debería ser `Rejected` y no lo es |
| X12 | Emisión con quórum de certificadores donde un certificador firma dos veces y otro no firma | Emisor + 1 certificador | Quórum por direcciones vs por firmas |
| X13 | Activo `Frozen` / `Paused` con solicitud ya `Pending` | Operador | Que la decisión o la liberación ignoren el estado |
| X14 | Manipular el orden de asientos / `prevHash` al leer desde el explorador (RPC mentiroso) | RPC propio o mitm local | Que el frontend declare la cadena íntegra sin recalcular bien |

#### C — DvP, plazos y reconciliación

| ID | Ataque | Capacidad | Qué busca |
|----|--------|-----------|-----------|
| X15 | Aprobación firmada que llega a Solana 1 slot antes del `hardDeadline` y reembolso en el mismo slot | Comprador + relayers lentos | Carrera P4 ampliada a nivel de slot |
| X16 | `refund_after_hard_deadline` invocado por un tercero que no es comprador ni vendedor | Cualquiera | Que el reembolso pague al caller |
| X17 | Depósito de pago con mint distinto al declarado en la solicitud, mismo decimals | Comprador malicioso | Sustitución de colateral (Cashio-like en DvP) |
| X18 | Depósito parcial: menos tokens de título o menos pago del requerido, luego pedir decisión | Titular/comprador | Escrow a medias que igual libera |
| X19 | Cancelación del vendedor tras el depósito del comprador, en distintos órdenes | Ambos | Fondos atrapados o liberación a medias |
| X20 | Reconciliación D6 aplicada dos veces con el mismo hash de resolución | Operador | Doble acuñación / doble asiento |
| X21 | Reconciliación D6 con hash de resolución vacío o de otra transferencia | Operador comprometido | Corrección inventada sin ancla |

#### D — Solana: cuentas, hook y Token-2022

| ID | Ataque | Capacidad | Qué busca |
|----|--------|-----------|-----------|
| X22 | Sustituir cada cuenta de cada instrucción por una con el mismo layout y otro owner | Programa atacante | Validación incompleta (matriz Cashio) |
| X23 | Sysvar de instrucciones falso + instrucción secp256k1 fabricada | Cualquiera | Bypass Wormhole-like |
| X24 | Transfer hook: CPI desde un programa intermediario que no es el escrow | Programa atacante | Bypass del camino autorizado |
| X25 | Transfer con delegate / permanent delegate no autorizado / burn / close account | Titular + cuentas auxiliares | Movimiento fuera de I5 |
| X26 | Recrear PDA de escrow con seeds distintas tras un cierre | Cualquiera | Colisión de PDA o escrow zombie |
| X27 | Mint Token-2022 con extensiones extra (transfer fee, non-transferable) coladas en la emisión | Emisor de mint paralelo | Que el programa acepte un mint no canónico |

#### E — Relayer, red y observabilidad

| ID | Ataque | Capacidad | Qué busca |
|----|--------|-----------|-----------|
| X28 | Reorg profunda en anvil tras `confirmations − 1` | Control del nodo local | Entrega prematura |
| X29 | Evento sintético con los mismos topics pero datos distintos, emitido por un contrato clon | Contrato atacante | Watcher que confía en topics sin `address` |
| X30 | API de lectura del relayer devolviendo estados terminales falsos mientras la cadena dice otra cosa | Relayer HTTP comprometido | Que un operador actúe solo con la API (cruzar con W6) |
| X31 | Relayer que firma mensajes de un `emitter` que no es el endpoint desplegado | 1 clave de relayer | Que el set acepte firmas sin atar emisor |
| X32 | Agotar la ventana de flujo con transferencias propias y bloquear a terceros (griefing) | k = umbral + capital | Denial of service económico dentro del diseño |

#### F — Frontend, operador humano y confusión

| ID | Ataque | Capacidad | Qué busca |
|----|--------|-----------|-----------|
| X33 | Clonar la UI cambiando solo `shared/` embebido / bundle | Sitio clonado | Que el usuario no note el endpoint distinto (medir mitigaciones W2–W4) |
| X34 | Pedir firma EIP-712 con campos en orden distinto o tipos alias | DApp maliciosa | Que la billetera muestre algo distinto a lo hasheado |
| X35 | Metadatos de activo con homógrafos Unicode y RTL override en nombre/descripción | Emisor | Confundir al comprador y al explorador |
| X36 | Deep link / query params que pre-rellenan montos y destinatarios | Sitio ajeno | Firma con datos no revisados pese a W3/W4 |

**Criterio mínimo EXTATK:** X1–X36 intentados; cero `roto`; todo `parcial` documentado con plan de cierre; informe revisado antes de TESTNET (local) y re-corrido selectivo en TESTNET (al menos X1, X4, X7, X15, X17, X23, X25, X28-equivalente en testnet si aplica, X33).

---

## 11. Gobernanza de fases (autorización obligatoria)

| Regla | Detalle |
|-------|---------|
| **Gate** | No se escribe código de una fase hasta: *"Autorizo Fase \<ID\>"* |
| **Entrega** | Al cerrar: checklist de aceptación, archivos tocados, salida de las comprobaciones de la fase |
| **Bloqueo** | Alcance nuevo → documentar y esperar autorización |
| **TDD** | En fases de contratos, programa y frontend: tests primero |

### Tablero de fases

| Fase | Nombre | Estado | Autorización |
|------|--------|--------|--------------|
| **BOOT** | Scaffold Foundry + Anchor + relayer, herramientas, `Makefile` | ✅ Cerrada | ✅ 2026-11-17 |
| **CODEC** | Formato de mensaje, dominio, vectores dorados en tres lenguajes | ✅ Cerrada | ✅ 2026-11-17 |
| **TITLE** | `TitleRegistry` + `IdentityRegistry` + módulos de cumplimiento + asientos encadenados | ⏳ Pendiente | ⬜ |
| **ATTEST** | Certificaciones con vencimiento y quórum; bloqueo por vencimiento; separación de roles | ⏳ Pendiente | ⬜ |
| **ENDPOINT** | `BridgeEndpoint`: quórum, ids, dominio, límites de flujo, pausa, rotación con timelock | ⏳ Pendiente | ⬜ |
| **MIRROR** | Programa Anchor: config, quórum secp256k1, mint Token-2022, hook, emisión | ⏳ Pendiente | ⬜ |
| **DVP** | Escrow de entrega contra pago, decisiones, plazos (D4–D6) | ⏳ Pendiente | ⬜ |
| **COURT** | Orden judicial, reconciliación, cierre en especie | ⏳ Pendiente | ⬜ |
| **RELAY** | Relayers, finalidad, idempotencia, entrega, reconciliador | ⏳ Pendiente | ⬜ |
| **E2E** | Stack local, escenarios de ciclo de vida y fallas inducidas | ⏳ Pendiente | ⬜ |
| **FRONT** | Frontend Next.js: explorador, cartera, operador, verificador, monitor del puente | ⏳ Pendiente | ⬜ |
| **REDTEAM** | Incidentes R1–R7, ataques P1–P9, ataques al frontend W1–W6, mutación, análisis estático | ⏳ Pendiente | ⬜ |
| **QA** | Agente QA que simula un humano: recorridos por rol, errores, plazos, recuperabilidad | ⏳ Pendiente | ⬜ |
| **EXTATK** | Set profundo X1–X36 ejecutado por **otro agente** atacante; informe `EXTATK-ES` | ⏳ Pendiente | ⬜ |
| **TESTNET** | **Sepolia + Solana Devnet** (ambas): ciclo real desde la UI y ataques rechazados con hashes | ⏳ Pendiente | ⬜ |
| **SOLV** | Invariantes finales, gas, SWC-AUDIT, docs EN, diagramas, portfolio | ⏳ Pendiente | ⬜ |

**Orden fijado tras FRONT:** REDTEAM → QA → EXTATK → TESTNET → SOLV. QA busca fallos de producto con mentalidad humana; EXTATK busca romper el sistema con mentalidad adversaria e independiente; TESTNET exige evidencia en **las dos** redes de prueba.

**Acuerdos cerrados (2026-11-16 / 2026-11-17):** orden post-FRONT confirmado; EXTATK en testnet = subconjunto obligatorio; catálogo X1–X36 fijo para v1; Solidity **`0.8.37`** (Cancun); **D1–D14 aceptadas** (2026-11-17). Seguimiento operativo en `doc/hitos-ES.md`.

**Cómo autorizar:** escribir *"Autorizo Fase BOOT"*.

---

## 12. Detalle por fase

### Fase BOOT — Scaffold

1. Foundry: `foundry.toml` (solc `0.8.37`, Cancun, optimizer, fuzz `runs = 1000`, invariant `runs = 256`, `depth = 50`; perfil `heavy` con `depth = 100`), remappings, `lib/` (forge-std, OpenZeppelin v5).
2. Anchor: `solana/` con `title_mirror`, Token-2022 habilitado, feature `redteam`.
3. `shared/`, `relayer/` y `e2e/` con `package.json`, `tsconfig`, `vitest`; `.nvmrc` con Node 22.
4. `frontend/` con Next.js 16, Tailwind 4, Vitest + Testing Library, Playwright, ESLint con la regla que prohíbe `dangerouslySetInnerHTML`, y cabeceras de seguridad (CSP, `frame-ancestors 'none'`) desde el primer día.
5. `.cursorrules` del módulo (Solidity + Solana + Next.js), `.env.example` (sin secretos), `Makefile` con `make check` vacío por etapas.
6. Linter desde el primer commit: sección `[fmt]` en `foundry.toml`, `scripts/lint.sh` (C0) y hook de pre-commit que corre `forge fmt --check`, `scripts/lint.sh`, `cargo fmt --check` y `npm run lint`. Test de humo del control: un archivo con un hallazgo a propósito tiene que hacer fallar `scripts/lint.sh`.
7. Instalar `slither`, `aderyn`, `cargo-audit` y Chromium de Playwright; dejar sus versiones anotadas en el README.

**Criterio de salida:** C0 verde; `forge build`, `anchor build`, `vitest run` y `npm run build` del frontend verdes con tests de humo; el hook de pre-commit bloquea un commit con un hallazgo de lint.

### Fase CODEC — El formato del mensaje

1. Escribir `doc/PROTOCOLO-ES.md`: campos, tamaños, orden de bytes, `MsgType`, dominio (`version`, `srcChain`, `dstChain`, `emitter`, `epoch`) y `messageId = keccak256(paquete)`.
2. TDD: `PacketCodec.sol` (partiendo del módulo 16), `codec.rs` y `codec.ts`.
3. `script/GenVectors.s.sol` genera `test/vectors/packets.json` (casos normales y bordes: montos cero y máximos, claves en cero, todos los tipos).

**Criterio de salida:** C5 verde. Los tres lenguajes coinciden byte a byte.

### Fase TITLE — El registro de títulos

1. TDD: emisión, transferencia válida, comprador sin identidad, regla de país, máximo de titulares, bloqueo temporal, estados.
2. `IdentityRegistry`: afirmaciones EIP-712 del verificador, vencimiento y revocación.
3. `TitleRegistry`: saldos por `(assetId, holder)`, solicitudes, decisiones, `LedgerChain` (asientos encadenados) y eventos.
4. Fuzz de reglas e invariantes I1, I7 e I9.

**Criterio de salida:** tests e invariantes verdes; cobertura de `TitleRegistry` ≥ 90 %.

### Fase ATTEST — Las certificaciones

1. TDD: emisión sin certificación → revert; certificación vencida → decisión `Rejected(CertificationExpired)`; quórum de certificadores para la emisión.
2. Comprobación de separación de roles en el despliegue (`RoleOverlap`).

**Criterio de salida:** tests verdes; I7 cubierta con certificaciones que vencen durante el fuzz.

### Fase ENDPOINT — El puente en Ethereum

1. TDD: quórum (exacto, de más, insuficiente, duplicado, firmante ajeno), dominio, id repetido, tipo no soportado, límites de flujo por ventana, pausa, rotación con timelock y época.
2. `RelayerQuorum` (partiendo de `RelayerSig` del módulo 09, con época), `MessageIdSet` y `FlowLimiter`.
3. Invariantes I3 e I8.

**Criterio de salida:** tests e invariantes verdes; R1, R5(a/b), R6 y R7 ya escritos como tests unitarios (su control positivo llega en REDTEAM).

### Fase MIRROR — El programa en Solana

1. TDD en `anchor test`: config, set de relayers con umbral válido, verificación de quórum por introspección de instrucciones secp256k1 (mensaje y direcciones), emisión por `ISSUE`.
2. Mint Token-2022 con transfer hook y delegado permanente (PDA del programa); `ExtraAccountMetaList` del hook.
3. El hook rechaza toda transferencia que no venga del escrow, de la liberación o del delegado permanente (I5).

**Criterio de salida:** tests verdes; R3 y R4 escritos contra el código real.

### Fase DVP — El escrow de entrega contra pago

1. Solana: `request_transfer` (token y pago al escrow, PDA por `transferId`), `apply_decision` (`Approved` → liberación cruzada; `Rejected`/`Expired` → reembolso), `refund_after_hard_deadline`.
2. Ethereum: registrar la solicitud, decidir con identidad, reglas, certificación y `deadline` (D4).
3. Invariantes I4 e I6; P4, P6 y P9.

**Criterio de salida:** tests verdes en las dos cadenas; escenario de carrera documentado en `PROTOCOLO`.

### Fase COURT — Orden judicial, reconciliación y cierre

1. Ethereum: transferencia forzada con hash de la resolución (rol de ejecutor judicial), reconciliación (D6) y cierre por rescate en especie.
2. Solana: `FORCED_TRANSFER` con el delegado permanente; quema en el rescate.
3. P7.

**Criterio de salida:** tests verdes; I1 e I2 se mantienen tras órdenes y rescates.

### Fase RELAY — Los relayers

1. Observadores de eventos (Ethereum: confirmaciones configurables y etiqueta `finalized` en Sepolia; Solana: compromiso `finalized`).
2. Firmante por proceso, intercambio de firmas, entrega permisionada solo por firmas (cualquiera puede enviar la transacción).
3. Almacén SQLite con clave única por id de mensaje, reintentos con espera exponencial.
4. Reconciliador: compara I2 y los estados de las solicitudes entre cadenas.
5. API de solo lectura (`/status`, `/messages`) para el monitor del frontend; sin rutas que escriban.

**Criterio de salida:** C9 verde; tests de idempotencia del almacén; test que confirma que la API no acepta métodos distintos de `GET`.

### Fase E2E — Todo junto, en local

1. `e2e/stack.sh`: anvil + solana-test-validator, despliegue de los dos lados, 3 relayers.
2. Escenarios de ciclo de vida: emisión → colocación → transferencia aprobada → transferencia rechazada → vencida → orden judicial → rescate.
3. Fallas inducidas F1–F5.

**Criterio de salida:** C10 verde; reconciliador limpio salvo el escenario D6, que debe detectarse y corregirse.

### Fase FRONT — El frontend

1. TDD por componente (Vitest + Testing Library, búsqueda por rol): conexión de las dos billeteras, guardas de red (W2), habilitación de botones por rol leído del contrato, pantalla de confirmación construida desde la transacción decodificada (W4), cuenta regresiva de plazos.
2. `lib/`: lectores de las dos cadenas usando `shared/`; verificación de la cadena de asientos en el navegador; constructores de transacciones (Ethereum con `ethers`, Solana con Anchor) con simulación previa.
3. Vistas de §6: explorador, cartera, operador, verificador y puente, con `error.tsx` y `not-found.tsx` por ruta; ES/EN.
4. Playwright contra el stack local, con la billetera de prueba solo bajo `NEXT_PUBLIC_E2E=1`. Recorridos completos **desde la interfaz**:
   - el emisor emite → el comprador deposita el pago → el vendedor pide la transferencia → la aprobación llega → la cartera de cada uno muestra el cambio;
   - transferencia rechazada por identidad vencida, con el motivo visible;
   - vencimiento y reembolso desde la cartera;
   - orden judicial desde la vista del operador y su reflejo en Solana;
   - el explorador muestra el historial y la cadena de hashes cuadra; si se altera un asiento en la lectura, marca en cuál se rompe.

**Criterio de salida:** C14, C15, C16 y C17 verdes; capturas de cada vista en `doc/` para el portfolio.

### Fase REDTEAM — La prueba de seguridad

1. Variantes vulnerables para R1–R7 (Solidity en `test/redteam/vulnerable/`, Solana con `redteam-*`); cada ataque gana contra su variante.
2. Los mismos ataques fallan contra el código real con el error esperado.
3. R5(c): con 2 de 3 claves comprometidas, medir la pérdida y compararla con el límite; activar la pausa y verificar que no sale nada más.
4. Ataques P1–P9 en unidad y en E2E.
5. Ataques al frontend W1–W6 en Playwright, con control positivo donde aplica (W1 y W4).
6. Mutación dirigida M1–M10.
7. `slither`, `aderyn`, `cargo audit`, `npm audit`: cada hallazgo corregido o justificado.
8. `doc/RED-TEAM-ES.md` con la tabla de resultados.

**Criterio de salida:** C4, C11, C12 y C16 verdes; documento de red team completo.

### Fase QA — Agente que simula un humano

No es red team. Es un **agente QA separado** (u otra sesión con brief de QA) que actúa como usuarios reales: lee pantallas, se confunde, reintenta, abandona a medias y vuelve. No tiene el árbol de tests en la cabeza; tiene guiones de persona y libertad exploratoria acotada.

**Personas obligatorias**

| Persona | Mentalidad | Billetera | Objetivo del recorrido |
|---------|------------|-----------|------------------------|
| Q-Titular | Quiere vender rápido; no lee tooltips | Phantom | Listar saldos, crear venta, cancelar, reintentar con otro precio |
| Q-Comprador | Desconfiado; cambia de opinión | Phantom | Empezar compra, salir, volver, depositar, esperar, pedir reembolso si vence |
| Q-Operador | Con prisa; varios roles en la misma seed de anvil por error | MetaMask | Emitir, pausar, reconciliar, orden judicial; comprobar que botones ajenos a su rol no se habilitan |
| Q-Verificador | Cuidadoso con vencimientos | MetaMask | Firmar identidad y certificación; intentar firmar con campos incompletos; ver avisos de vencimiento |
| Q-Público | Sin billetera | — | Explorador y monitor del puente; compartir un `assetId` mal formado; comprobar 404 y errores |
| Q-Novato | Primera vez; red equivocada a propósito | MetaMask/Phantom en red incorrecta | Debe ver bloqueo claro (W2) y recuperar al cambiar de red sin estado corrupto |

**Guiones (mínimo; el agente puede explorar alrededor)**

1. Ciclo feliz completo desde la UI (emisión → venta → depósito → aprobación → saldos nuevos).
2. Abandono a mitad: depósito de pago sin que el vendedor confirme; luego cancelación o vencimiento.
3. Identidad o certificación a punto de vencer: el humano ve el motivo de rechazo en lenguaje claro.
4. Doble clic / reenvío de la misma acción (doble submit): no debe duplicar solicitudes ni pedidos de firma contradictorios.
5. Recarga de página en cada paso crítico: el estado se rehace desde la cadena, no desde un cache mentiroso.
6. Cambio de cuenta en la billetera a mitad de un formulario: la UI invalida el borrador o avisa.
7. Mensajes del puente “en vuelo” durante una espera larga: el humano entiende qué esperar y hasta cuándo (`deadline` / `hardDeadline`).
8. Error de RPC / relayer caído: mensaje accionable; no pantalla blanca; no botón que finge éxito.
9. i18n: alternar ES/EN a mitad de un flujo sin perder el contexto ni mezclar cadenas.
10. Accesibilidad básica: navegación por teclado en formularios críticos; textos de error asociados al campo.

**Entrega:** `doc/QA-ES.md` con hallazgos clasificados (`bloqueante` / `mayor` / `menor` / `mejora`), capturas, pasos de reproducción y veredicto por persona. Los `bloqueante` y `mayor` se corrigen antes de EXTATK.

**Criterio de salida:** las 6 personas cubiertas; los 10 guiones ejecutados contra el stack local; cero hallazgos bloqueantes abiertos; informe QA revisado.

### Fase EXTATK — Ataques profundos por otro agente

1. Congelar el brief del agente atacante: §10.7, PROTOCOLO, ABIs/IDL, direcciones del stack local; **sin** abrir `test/redteam/` ni los asserts de C11.
2. Ejecutar X1–X36 en local; registrar cada resultado en `doc/EXTATK-ES.md`.
3. Todo `roto` se corrige en el código (vuelve la fase dueña del control) y se re-ataca el ítem.
4. Todo `parcial` tiene dueño, mitigación o aceptación explícita firmada en el informe.
5. Preparar la lista corta de re-ataque en TESTNET (mínimo el subconjunto de §10.7).

**Criterio de salida:** catálogo X1–X36 cerrado en local; cero `roto`; informe listo para acompañar el despliegue en ambas testnets.

### Fase TESTNET — Evidencia pública en Sepolia y Solana Devnet

**Ambas redes son obligatorias.** No se acepta evidencia solo en una punta.

1. Desplegar contratos en **Sepolia** y el programa en **Solana Devnet**; 3 relayers corriendo contra RPC públicos de las dos redes.
2. Frontend apuntando a Sepolia **y** Devnet a la vez (build local; Vercel solo si se decide publicarlo).
3. Un ciclo completo real **hecho desde la interfaz con MetaMask (Sepolia) y Phantom (Devnet)**: emisión, transferencia con entrega contra pago, rechazo, orden judicial.
4. Ataques reales contra el despliegue en las dos puntas: repetir un mensaje real ya procesado (P1), enviar una firma de un relayer removido (R5b), intentar transferir fuera del escrow (P3), más el subconjunto EXTATK acordado.
5. Re-correr en testnet los guiones QA críticos del ciclo feliz y del rechazo por identidad (smoke humano).
6. `doc/DEPLOY-TESTNET-ES.md` con direcciones, ids de programa, hashes de cada transacción en **Sepolia y Devnet** (incluidas las rechazadas) y capturas de la interfaz en cada paso.

**Criterio de salida:** operaciones del punto 3 confirmadas en ambas cadenas; ataques del punto 4 rechazados con hash en la punta que corresponda; checklist de las dos testnets completo — sin eso no hay SOLV.

### Fase SOLV — Cierre de v1

1. Repasar invariantes, gas (`forge snapshot`), NatSpec.
2. Verificar que `QA-ES`, `EXTATK-ES` y `DEPLOY-TESTNET-ES` (Sepolia **y** Devnet) están completos y sin ítems bloqueantes abiertos.
3. `SWC-AUDIT-ES`, `GAS-ES`, diagramas (clases, flujo, flujograma), docs EN, README del módulo (con capturas y un video corto del recorrido), portfolio.
4. Actualizar el índice de la suite (`doc/README.md`: módulos 01–22).

**Criterio de salida:** `make check` verde de punta a punta; evidencia de ambas testnets presente; informes QA y EXTATK cerrados.

---

## 13. Checklist de aceptación global (v1)

- [ ] Códec idéntico en Solidity, Rust y TypeScript (vectores dorados)
- [ ] Registro de títulos con identidad, reglas, certificaciones que vencen y asientos encadenados
- [ ] Puente con quórum ≥ ⌈2n/3⌉, dominio con época, ids únicos, límites de flujo y pausa
- [ ] Mint Token-2022 que solo se mueve por el flujo autorizado (hook) y por orden judicial (delegado permanente)
- [ ] Entrega contra pago atómica en Solana, con plazos D4–D6
- [ ] Invariantes I1–I9 cubiertas
- [ ] Incidentes R1–R7 reproducidos con control positivo y rechazados por el código real
- [ ] Ataques P1–P9 y fallas F1–F5 cubiertos
- [ ] Mutantes M1–M10 detectados
- [ ] Formato y linter en `make check` y en pre-commit, sin hallazgos ni excepciones sin motivo
- [ ] Análisis estático y de dependencias sin hallazgos sin justificar
- [ ] Frontend con explorador, cartera, operador, verificador y monitor del puente, ES/EN
- [ ] Ataques al frontend W1–W6 cubiertos; build de producción sin código de test
- [ ] Fase QA: 6 personas y 10 guiones cubiertos; cero bloqueantes abiertos (`doc/QA-ES.md`)
- [ ] Fase EXTATK: X1–X36 ejecutados por agente atacante aparte; cero `roto` (`doc/EXTATK-ES.md`)
- [ ] Ciclo completo desde la interfaz en **Sepolia y Solana Devnet** (ambas), con hashes
- [ ] Ataques rechazados en **ambas** testnets (P1, R5b, P3 + subconjunto EXTATK), con hashes
- [ ] Docs ES/EN, SWC-AUDIT, GAS, diagramas y portfolio

---

## 14. Próximo paso

Orden, EXTATK en testnet (subconjunto), X1–X36 y **D1–D14**: **cerrados**. Tablero: [`doc/hitos-ES.md`](hitos-ES.md).

**Siguiente:** autorizar la primera fase con *"Autorizo Fase BOOT"*.

**Ruta:** local → REDTEAM → QA → EXTATK → **Sepolia + Solana Devnet** → SOLV. Sin evidencia en las dos testnets, v1 no cierra.
