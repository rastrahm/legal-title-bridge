# Phased refactor — Legal Title Bridge

> 🌐 **English** · [Español](./REFACTOR-ES.md)

**Status:** closed (2026-11-23).  
**Constraint:** preserve Solidity ABI, Anchor IDL, wire codec, and Sepolia/Devnet addresses. No redeploy.

## Phases

| ID | Scope | Result |
|----|-------|--------|
| REF-0 | Inventory + baseline + this doc | ✅ |
| REF-1 | Solana `inbound` + thin `apply_*` | ✅ 18 unit tests + clippy `-D warnings` |
| REF-2 | `TitleRegistry._emitOutboundIfWired` | ✅ forge title/court/dvp; gas Δ documented |
| REF-3 | `shared/` single source | ✅ shared tests + consumer imports |
| REF-4 | Frontend helpers + thin pages | ✅ lint + coverage |
| REF-5 | Testnet scripts → relayer wrappers | ✅ `npm test` + typecheck |
| REF-6 | `make check` + doc closeout | ✅ |

## Highlights

- Solana `inbound.rs` centralizes domain/parse/quorum; P7 shares forced verify.
- Eth private `_emitOutboundIfWired` only (no storage reorder). Gas: issue −78, decide −61.
- Shared as import source; frontend/relayer stop duplicating addresses in tests.
- Frontend `cartera/helpers` + `prepareLabIssueTx`; E2E testids unchanged.
- Relayer: thin wrappers under `scripts/testnet/`; GET-only HTTP unchanged.

## No-break

`DEPLOY-TESTNET-*` untouched. External ABI/IDL signatures unchanged; hot-path gas Δ documented in GAS docs.
