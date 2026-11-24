# Refactor por fases — Legal Title Bridge

> 🌐 **Español** · [English](./REFACTOR-EN.md)

**Estado:** cerrado (2026-11-23).  
**Premisa:** preservar ABI Solidity, IDL Anchor, códec/wire y direcciones Sepolia/Devnet. Sin redeploy.

## Fases

| ID | Alcance | Resultado |
|----|---------|-----------|
| REF-0 | Inventario + baseline + este doc | ✅ |
| REF-1 | Solana `inbound` + `apply_*` delgados | ✅ `cargo test` 18 + clippy `-D warnings` |
| REF-2 | `TitleRegistry._emitOutboundIfWired` | ✅ forge title/court/dvp; gas Δ documentada |
| REF-3 | `shared/` fuente única | ✅ tests shared + imports frontend/relayer |
| REF-4 | Frontend helpers + páginas delgadas | ✅ lint + coverage |
| REF-5 | Scripts testnet → wrappers relayer | ✅ `npm test` + typecheck |
| REF-6 | `make check` + cierre docs | ✅ |

## Cambios clave

- **Solana:** `src/inbound.rs` — dominio Eth→Sol, parse ISSUE/DECISION/FORCED, quorum; `apply_forced_p7` reutiliza `parse_and_verify_forced`.
- **Ethereum:** helper privado `_emitOutboundIfWired` (sin reordenar storage). Gas: issue 160 929 (−78), decide 161 003 (−61).
- **shared:** reexports; tests frontend dejan de hardcodear addresses.
- **frontend:** `lib/cartera/helpers.ts`, `prepareLabIssueTx`; testids E2E intactos.
- **relayer:** `scripts/testnet/{run-relayer-status,attacks-p1-r5b,build-x4-wire}.mjs` wrappers; API GET-only sin cambios.

## No-break

Evidencia `DEPLOY-TESTNET-*` sin tocar. Bytecode hot-path solo Δ gas menor documentada; IDL/ABI externas sin cambio de firmas.
