# Milestones — Module 22: Legal Title Bridge

> 🌐 **English** · [Español](./hitos-ES.md)

**Usage:** mark `[x]` when closing each item. Does not replace phase authorization (`Autorizo Fase <ID>` in `planificacion-EN.md`).
**v1 target:** evidence on **Sepolia** and **Solana Devnet** (both).
**Closed order after FRONT:** REDTEAM → QA → EXTATK → TESTNET → SOLV.
**EXTATK:** X1–X36 fixed locally; mandatory subset on testnet.
**Last updated:** 2026-11-22

---

## How to mark

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Pending |
| `[x]` | Done (phase exit criterion met) |
| Authorization | Only after *"Autorizo Fase \<ID\>"* |
| Report | Link or note on close (hash, PR, doc path) |

---

## Planning agreements (closed)

- [x] Target: Sepolia + Solana Devnet (both mandatory)
- [x] Post-FRONT order: REDTEAM → QA → EXTATK → TESTNET → SOLV
- [x] EXTATK on testnet = subset (do not repeat full X1–X36)
- [x] X1–X36 catalog fixed for v1 (nothing optional by default)
- [x] Module Solidity: exact `0.8.37` (EVM Cancun); Solana unchanged (Anchor 0.31.1 / CLI 2.2.20)
- [x] Code comments: English only, or bilingual ES+EN (never Spanish-only)
- [x] Design docs: classes, flow, flowchart, attack map, attack surface (ES)
- [x] Decisions D1–D14 reviewed and accepted (especially D5/D6) — 2026-11-17
- [x] First phase authorized: *"Autorizo Fase BOOT"* — 2026-11-17 · branch `boot`

---

## Quick board

| # | Phase | Authorized | Closed | Evidence / note |
|---|-------|:----------:|:------:|-----------------|
| 1 | BOOT | ✅ | ✅ | `make check-boot` OK · 2026-11-17 · branch `boot` |
| 2 | CODEC | ✅ | ✅ | `make check-codec` C5 OK · 2026-11-17 · branch `codec` |
| 3 | TITLE | ✅ | ✅ | `make check-title` · TitleRegistry 98.9% · I1/I7/I9 · 2026-11-17 · branch `title` |
| 4 | ATTEST | ✅ | ✅ | `make check-attest` · quorum 2/n · I7 with expiring certs · 2026-11-18 · branch `attest` |
| 5 | ENDPOINT | ✅ | ✅ | `make check-endpoint` · I3/I8 · R1/R5a-b-c/R6/R7 · 2026-11-18 · branch `endpoint` |
| 6 | MIRROR | ✅ | ✅ | `make check-mirror` · R3/R4/R6 · I5 path · Token-2022 · 2026-11-18 · branch `mirror` |
| 7 | DVP | ✅ | ✅ | 2026-11-18 |
| 8 | COURT | ✅ | ✅ | 2026-11-19 |
| 9 | RELAY | ✅ | ✅ | 2026-11-19 |
| 10 | E2E | ✅ | ✅ | `make check-e2e` C10 · sim harness + F1–F5/D6 · 2026-11-19 · branch `e2e` |
| 11 | FRONT | ✅ | ✅ | `make check-front` C14–C17 · 2026-11-19 · branch `front` |
| 12 | REDTEAM | ✅ | ✅ | `make check-redteam` C4/C11/C12/C16 · 2026-11-20 · branch `redteam` |
| 13 | QA | ✅ | ✅ | `make check-qa` · 6 personas + G1–G10 · 2026-11-20 · branch `qa` |
| 14 | EXTATK | ✅ | ✅ | `make check-extatk` · X1–X36 · 0 broken · 2026-11-20 · `doc/EXTATK-EN.md` |
| 15 | TESTNET | ✅ | ✅ | Closed 2026-11-23 · Deploy+UI+DvP · shortlist+X4 · X7/X15/X28 deferred opt. · `doc/DEPLOY-TESTNET-EN.md` |
| 16 | SOLV | ✅ | ✅ | Closed 2026-11-23 · `make check` green · EN docs + portfolio |

---

## Milestones by phase

### 1. BOOT — Scaffold

- [x] Authorized (2026-11-17, branch `boot`)
- [x] Foundry + OZ v5 + `foundry.toml` (0.8.37, Cancun, fuzz/invariant)
- [x] Anchor `title_mirror` + Token-2022 + feature `redteam`
- [x] `shared/`, `relayer/`, `e2e/` (Node 22, vitest)
- [x] `frontend/` Next.js 16 + Tailwind 4 + Playwright + CSP
- [x] `Makefile`, `.cursorrules`, `.env.example`, pre-commit + `scripts/lint.sh`
- [x] Tools: slither 0.11.6, aderyn 0.6.8, cargo-audit 0.23.0, Chromium Playwright
- [x] Criterion: C0; `make check-boot` green; fixture lint fails on purpose; hook installed

### 2. CODEC — Message format

- [x] Authorized (2026-11-17, branch `codec`)
- [x] `doc/PROTOCOLO-EN.md` written
- [x] `PacketCodec.sol` + `codec.rs` + `codec.ts` (TDD)
- [x] Golden vectors `test/vectors/packets.json` (8 vectors)
- [x] Criterion: C5 green (three languages identical) · `make check-codec`

### 3. TITLE — Title registry

- [x] Authorized (2026-11-17, branch `title`)
- [x] `IdentityRegistry` (EIP-712, expiry, revocation)
- [x] `TitleRegistry` + compliance (`Country`/`MaxHolders`/`Lockup`) + `LedgerChain`
- [x] Invariants I1, I7, I9
- [x] Criterion: tests green; TitleRegistry coverage ≥ 90 % (98.9% lines) · `make check-title`

### 4. ATTEST — Certifications

- [x] Authorized (2026-11-18, branch `attest`)
- [x] Issuance blocked without certification / expired → `Rejected(CertificationExpired)`
- [x] Certifier quorum (existence + registry); `RoleOverlap` on deploy
- [x] Criterion: I7 with expiries in fuzz · `make check-attest`

### 5. ENDPOINT — Ethereum bridge

- [x] Authorized (2026-11-18, branch `endpoint`)
- [x] Quorum, domain, ids, `MsgType`, flow limit, pause, timelock + epoch
- [x] Invariants I3, I8
- [x] Unit tests R1, R5(a/b/c), R6, R7 (no positive control yet)
- [x] Criterion: tests and invariants green · `make check-endpoint`

### 6. MIRROR — Solana program

- [x] Authorized (2026-11-18, branch `mirror`)
- [x] Config, set relayers, secp256k1 quorum, `apply_issue`
- [x] Token-2022 mint + mint authority PDA (permanent delegate) + hook path checks
- [x] I5: `assert_transfer_path` / hook rejects foreign authorities
- [x] R3 (Instructions sysvar) and R4 (mint/config constraints) against real code
- [x] Criterion: `anchor test` + `cargo test -p title_mirror` green · `make check-mirror`

### 7. DVP — Delivery versus payment

- [x] Authorized (2026-11-18, branch `dvp`)
- [x] Solana escrow: `request_transfer` / `apply_decision` / `refund_after_hard_deadline`
- [x] Ethereum decision with D4 + outbound `TRANSFER_DECISION` via BridgeEndpoint
- [x] I4, I6; P4 (documented), P6, P9
- [x] Criterion: tests on both chains; D6 race in `PROTOCOLO` §6.1 · `make check-dvp`

### 8. COURT — Court order and reconciliation

- [x] Authorized (2026-11-19, branch `court`)
- [x] Outbound `FORCED_TRANSFER` + `apply_forced_transfer` / `apply_forced_p7` (Solana)
- [x] D6 reconciliation (X20/X21); in-kind redemption (`redeemInKind` → burn wire `to=0`)
- [x] P7: cancel Pending on Eth + CourtCancelled escrow on Solana
- [x] Criterion: I1 on Eth after orders/redemptions · `make check-court`

### 9. RELAY — Relayers

- [x] Authorized (2026-11-19, branch `relay`)
- [x] Eth watchers (confirmations/`finalized`) + Sol (`finalized`); signer; quorum submitter
- [x] Idempotent SQLite (`node:sqlite`) + exponential backoff
- [x] I2 reconciler + D6 detection
- [x] Read-only API `GET /status`, `GET /messages` (405 on non-GET)
- [x] Criterion: C9 · `make check-relay`

### 10. E2E — Local stack

- [x] Authorized (2026-11-19, branch `e2e`)
- [x] `e2e/stack.sh` (`sim` by default: in-process harness; `full`: anvil + solana-test-validator)
- [x] Full lifecycle (issue → placement → approve/reject/expire → court/P7 → redeem)
- [x] Failures F1–F5 (kill/restart, double deliver, out-of-order, D6, pre-confirm reorg)
- [x] Criterion: C10 · `make check-e2e`; D6 detected and corrected; reconciler clean on lifecycle

### 11. FRONT — Frontend

- [x] Authorized (2026-11-19, branch `front`)
- [x] Views: explorer, wallet, operator, verifier, bridge
- [x] Guards W2/W4; ES/EN; pre-sign simulation
- [x] Playwright against local stack (flows + W1–W6)
- [x] Criterion: C14–C17 · `make check-front`; screenshots in `doc/front-screenshots/`

### 12. REDTEAM — In-repo security

- [x] Authorized (2026-11-20, branch `redteam`)
- [x] R1–R7 with positive control + rejection on real code
- [x] P1–P9; W1–W6; M1–M10
- [x] Slither / Aderyn / justified audits (`doc/SWC-AUDIT-EN.md`)
- [x] `doc/RED-TEAM-EN.md` complete
- [x] Criterion: C4, C11, C12, C16 · `make check-redteam`

### 13. QA — Simulated human agent

- [x] Authorized (2026-11-20, branch `qa`)
- [x] Personas: Holder, Buyer, Operator, Verifier, Public, Novice
- [x] Scripts 1–10 executed on local stack
- [x] `doc/QA-EN.md` with no open blockers/majors
- [x] Criterion: QA phase closed · `make check-qa`

### 14. EXTATK — Separate attacker agent

- [x] Authorized (independent external attacker agent — 2026-11-20)
- [x] Brief without `test/redteam/` (restricted access; no C11 visibility)
- [x] X1–X36 locally; **zero `broken`**; 34 blocked; 2 partial (X30, X32 — by design)
- [x] `partial` documented with close-out plan in `doc/EXTATK-EN.md §Notes`
- [x] `doc/EXTATK-EN.md` complete with table, notes, and TESTNET shortlist
- [x] TESTNET shortlist: X1, X4, X7, X15, X17, X23, X25, X28, X33
- [x] Criterion: local catalog closed · `make check-extatk` green

### 15. TESTNET — Sepolia + Solana Devnet

- [x] Authorized (2026-11-21)
- [x] Deploy Sepolia + Devnet + 3 relayers (status API) — contracts + program + config
- [x] MetaMask + Phantom UI cycle (2026-11-22): `registerAssertion` `0x146532…` · `issue` `0xa1b9…` · Phantom `EDTzyw…M4x5` (Wallet sell/buy = demo)
- [x] Attacks: P1 · R5b (invalid signature) · P3 Devnet · `apply_issue` mint=1000 · `executeRotateRelayers` + X4 ✅
- [x] Executable EXTATK subset: X1/X17/X23/X25/X33 ✅ · X4 ✅ (2026-11-23) · X7/X15/X28 deferred opt.
- [x] QA smoke: happy Eth path + identity rejection (`InvalidSignature`) + W2 MetaMask Mainnet→Sepolia
- [x] `doc/DEPLOY-TESTNET-EN.md` with addresses/hashes (redeploy `2DvHn2…` + apply_issue + shortlist + UI)
- [x] Criterion: full checklist — **phase closed 2026-11-23**

### 16. SOLV — v1 close-out

- [x] Authorized (2026-11-23)
- [x] Invariants I1–I9 documented + `forge test --mt invariant_` green · gas `HotPath` + snapshot
- [x] QA + EXTATK + DEPLOY-TESTNET with no blockers
- [x] SWC-AUDIT ES/EN · GAS ES/EN · EN diagram stubs · key EN docs · portfolio/
- [x] Suite index `doc/README.md` → 01–22
- [x] Criterion: end-to-end `make check` green (includes `check-extatk` + `check-solv`) — **phase closed 2026-11-23**

---

## Cross-cutting milestones (v1 acceptance)

- [ ] Identical codec Solidity / Rust / TypeScript
- [ ] Invariants I1–I9 covered
- [x] REDTEAM + mutation + static closed
- [x] QA closed
- [x] EXTATK X1–X36 closed (local) + testnet subset prepared
- [x] Sepolia evidence (deploy + UI `registerAssertion`/`issue` + P1/R5b/X1…)
- [x] Solana Devnet evidence (program `2DvHn2…` + `apply_issue` + P3 + Phantom connect)
- [x] ES/EN docs + portfolio (optional video walkthrough)

---

## Next active milestone

1. ~~TESTNET~~ ✅ closed 2026-11-23
2. ~~SOLV~~ ✅ closed 2026-11-23 · `make check` green · v1 lab complete
3. ~~REF-0…6~~ ✅ closed 2026-11-23 · [REFACTOR-EN.md](./REFACTOR-EN.md) · ABI/IDL/codec preserved · `make check` green
4. Optional: video walkthrough · X7/X15/X28 on-chain · §13 residuals (codec/I1–I9 checklist / mutants)
