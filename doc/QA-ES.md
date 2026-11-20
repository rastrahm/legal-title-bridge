# QA — agente humano simulado

**Fase:** QA · **Rama:** `qa` · **Fecha:** 2026-11-20  
**Stack:** Next.js lab (`frontend/`, store demo) + Playwright Chromium  
**Suite:** `frontend/e2e/qa-personas.spec.ts` · capturas en `doc/qa-screenshots/`

## Veredicto

| Criterio | Estado |
|----------|--------|
| 6 personas cubiertas | ✅ |
| Guiones 1–10 ejecutados | ✅ |
| Hallazgos `bloqueante` abiertos | **0** |
| Hallazgos `mayor` abiertos | **0** (corregidos en esta fase) |
| Informe revisado | ✅ |

**Comando:** `cd frontend && npx playwright test e2e/qa-personas.spec.ts` (también en `make check-qa`).

---

## Personas

| Persona | Resultado | Notas |
|---------|-----------|-------|
| Q-Titular | ✅ | Conecta Phantom (lab), vende, cancela, reintenta precio 9 |
| Q-Comprador | ✅ | Compra/depósito demo, sale a home, vuelve sin pantalla rota |
| Q-Operador | ✅ | Emitir → confirmar; pausa; reconciliar; orden; strip roles deshabilita botones |
| Q-Verificador | ✅ | Campos incompletos bloquean firma; aviso ligado al campo |
| Q-Público | ✅ | Explorador, puente, `assetId` inválido, 404 |
| Q-Novato | ✅ | `e2eChain=1` bloquea (W2); al volver a local + conectar, Emitir se habilita |

---

## Guiones 1–10

| # | Guion | Resultado |
|---|-------|-----------|
| 1 | Ciclo feliz UI (emitir + confirmar; I2 en `/puente`) | ✅ |
| 2 | Abandono a mitad + cancelar venta | ✅ |
| 3 | Motivo de rechazo por certificación clara | ✅ |
| 4 | Doble submit: un solo panel de confirmación | ✅ |
| 5 | Recarga: estado lab se reinicia (demo en memoria) | ✅ (aceptado, ver menor) |
| 6 | Cambio de cuenta invalida borrador | ✅ |
| 7 | Mensajes en vuelo + hint deadline/hardDeadline | ✅ |
| 8 | Relayer ausente: copy accionable, no pantalla blanca | ✅ |
| 9 | i18n ES↔EN sin mezclar chrome crítico | ✅ |
| 10 | Teclado + `aria-describedby` en verificador | ✅ |

---

## Hallazgos

### Mayor (corregidos)

| ID | Hallazgo | Fix |
|----|----------|-----|
| QA-M1 | Cadenas ES hardcodeadas (rompe guion i18n) | Claves en `lib/i18n.ts`; vistas usan `dict` |
| QA-M2 | Vender/Comprar sin efecto | Acciones demo + avisos en `/cartera` |
| QA-M3 | Emitir sin billetera conectada | `canSignEth` exige `ethAddress` |
| QA-M4 | Doble clic abría caminos confusos | `busy` / `pendingTx` deshabilitan Emitir |
| QA-M5 | Cambio de cuenta no limpiaba borrador | `useEffect` limpia `pendingTx` + aviso |
| QA-M6 | CSP `script-src` sin `'unsafe-inline'` rompía hidratación en **dev** | `next.config.ts`: unsafe-inline solo fuera de production |

### Menor / mejora (abiertos, no bloquean EXTATK)

| ID | Clase | Hallazgo | Dueño |
|----|-------|----------|-------|
| QA-m1 | menor | Recarga pierde store demo (no es lectura de cadena) | Lab v1; TESTNET usará RPC reales |
| QA-m2 | menor | Countdown de cartera usa `now` fijo de demo | UX; polarizar a reloj real en TESTNET |
| QA-m3 | mejora | Home no muestra montos Eth/Sol, solo I2 | Nice-to-have |
| QA-m4 | menor | Botón “Quitar roles (lab)” visible en operador | Solo lab; ocultar tras E2E si molesta |

### Bloqueante

Ninguno.

---

## Capturas

`doc/qa-screenshots/`: `q-titular`, `q-comprador`, `q-operador`, `q-verificador`, `q-publico`, `q-novato`, `g1-happy`.

## Regresión

`e2e/attacks-w.spec.ts` + `e2e/flows.spec.ts` verdes tras los fixes (26 tests Playwright en la corrida combinada).
