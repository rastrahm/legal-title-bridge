# Invariantes I1–I9 — Legal Title Bridge

> 🌐 **Español** · [English](./INVARIANTES-EN.md)

Fuente: [`planificacion-ES.md`](./planificacion-ES.md) §8, Foundry `test/invariant/`, cobertura Anchor/E2E/reconciliador en hitos (`hitos-ES.md`).  
**SOLV:** la matriz debe seguir verde bajo `make check` (C2 / C7 / C9 / C10).

---

## Matriz de cobertura

| ID | Invariante | Foundry invariant | Anchor | E2E | Reconciliador |
|----|------------|-------------------|--------|-----|---------------|
| **I1** | Por activo: Σ saldos del registro = emitidas − rescatadas | ✅ `TitleRegistry.invariants.t.sol` (conservación) | — (estado Eth) | ✅ lifecycle / caminos court | Indirecto (circulante Eth de entrada) |
| **I2** | Por activo: supply del mint Solana = unidades del registro Eth | — | Lecturas de supply en flujos mirror | ✅ tras cada escenario (`fleet.reconcile`) | ✅ `checkI2` / `buildReconcileReport` (`relayer/`) |
| **I3** | Cada id de mensaje se aplica ≤ una vez por cadena | ✅ `BridgeEndpoint.invariants.t.sol` | ✅ cuentas / errores de mensaje procesado | ✅ F1/F2 entrega duplicada | — |
| **I4** | Cada solicitud termina en un solo estado terminal (`Completed` **o** `Refunded`; nunca ambos; nunca vuelve a `Pending`) | Parcial vía handlers decide/request | ✅ máquina de estados del escrow (tests DVP) | ✅ lifecycle + F4/P4 | ✅ mismatch de estado / detección D6 |
| **I5** | Los tokens de título en Solana solo se mueven por escrow, liberación por decisión o delegado permanente (corte) | — | ✅ transfer hook + `assert_transfer_path` | ✅ P3 / EXTATK X24–X25 | — |
| **I6** | El pago se conserva: termina en el vendedor o vuelve al comprador | — | ✅ apply_decision / refund | ✅ lifecycle reject/expire/refund | — |
| **I7** | Nunca se aprueba con certificación vencida ni titular sin identidad vigente | ✅ `TitleRegistry` + `AttestationI7.invariants.t.sol` (+ fuzz) | — (la decisión es Eth) | ✅ rechazo por identidad | — |
| **I8** | Umbral ≥ ⌈2n/3⌉ y n ≥ 3 en todo momento | ✅ `BridgeEndpoint.invariants.t.sol` (rotaciones) | ✅ checks de config / umbral en rotación | — | — |
| **I9** | Cadena de asientos continua: cada `entryHash` encadena con el anterior | ✅ `TitleRegistry.invariants.t.sol` | — | El explorador UI recalcula en el cliente | — |

---

## Artefactos principales

| Capa | Rutas |
|------|-------|
| Foundry | `test/invariant/TitleRegistry.invariants.t.sol`, `AttestationI7.invariants.t.sol`, `BridgeEndpoint.invariants.t.sol` (+ handlers) |
| Anchor | `solana/tests/title_mirror.ts`; `hook.rs` / instrucciones de escrow |
| E2E | `e2e/test/lifecycle.test.ts`, `failures.test.ts` (F1–F5); suites redteam/extatk |
| Relayer | `relayer/src/reconciler.ts`, `relayer/test/reconciler.test.ts` |

Perfil: invariant por defecto `runs ≥ 256`, `depth ≥ 50`; `heavy` → `runs = 512`, `depth = 100` (`foundry.toml`).
