# Invariants I1–I9 — Legal Title Bridge

> 🌐 **English** · [Español](./INVARIANTES-ES.md)

Source: [`planificacion-ES.md`](./planificacion-ES.md) §8, Foundry `test/invariant/`, Anchor/E2E/reconciler coverage in milestones (`hitos-ES.md`).  
**SOLV:** matrix must stay green under `make check` (C2 / C7 / C9 / C10).

---

## Coverage matrix

| ID | Invariant | Foundry invariant | Anchor | E2E | Reconciler |
|----|-----------|-------------------|--------|-----|------------|
| **I1** | Per asset: Σ registry balances = issued − redeemed | ✅ `TitleRegistry.invariants.t.sol` (conservation) | — (Eth state) | ✅ lifecycle / court paths | Indirect (Eth circulating input) |
| **I2** | Per asset: Solana mint supply = Eth registry units | — | Supply reads in mirror flows | ✅ after each scenario (`fleet.reconcile`) | ✅ `checkI2` / `buildReconcileReport` (`relayer/`) |
| **I3** | Each message id applied ≤ once per chain | ✅ `BridgeEndpoint.invariants.t.sol` | ✅ processed-message accounts / errors | ✅ F1/F2 duplicate delivery | — |
| **I4** | Each request ends in a single terminal state (`Completed` **or** `Refunded`; never both; never back to `Pending`) | Partial via decide/request handlers | ✅ escrow status machine (DVP tests) | ✅ lifecycle + F4/P4 | ✅ status mismatch / D6 detection |
| **I5** | Solana title tokens move only via escrow, decision release, or permanent delegate (court) | — | ✅ transfer hook + `assert_transfer_path` | ✅ P3 / EXTATK X24–X25 paths | — |
| **I6** | Payment conserved: ends with seller or returns to buyer | — | ✅ apply_decision / refund paths | ✅ lifecycle reject/expire/refund | — |
| **I7** | Never approve with expired certification or unverified holder | ✅ `TitleRegistry` + `AttestationI7.invariants.t.sol` (+ fuzz) | — (decision is Eth) | ✅ reject-by-identity scenarios | — |
| **I8** | Threshold ≥ ⌈2n/3⌉ and n ≥ 3 at all times | ✅ `BridgeEndpoint.invariants.t.sol` (rotations) | ✅ config / rotate threshold checks | — | — |
| **I9** | Ledger chain continuous: each `entryHash` links previous | ✅ `TitleRegistry.invariants.t.sol` | — | Explorer UI verifies chain client-side | — |

---

## Primary artifacts

| Layer | Paths |
|-------|-------|
| Foundry | `test/invariant/TitleRegistry.invariants.t.sol`, `AttestationI7.invariants.t.sol`, `BridgeEndpoint.invariants.t.sol` (+ handlers) |
| Anchor | `solana/tests/title_mirror.ts`; `hook.rs` / escrow instructions |
| E2E | `e2e/test/lifecycle.test.ts`, `failures.test.ts` (F1–F5); redteam/extatk suites |
| Relayer | `relayer/src/reconciler.ts`, `relayer/test/reconciler.test.ts` |

Profile: default invariant `runs ≥ 256`, `depth ≥ 50`; `heavy` → `runs = 512`, `depth = 100` (`foundry.toml`).
