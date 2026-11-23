# Planning — Module 22: Legal Title Bridge (Ethereum ↔ Solana)

> 🌐 **English** · [Español](./planificacion-ES.md)

**Status:** phases BOOT→**SOLV** **closed** (2026-11-23). v1 lab accepted on Sepolia+Devnet. Board: `hitos-ES.md`.  
**Progress rule:** no phase code until *"Autorizo Fase \<ID\>"*.  
**Acceptance target:** **Ethereum Sepolia** + **Solana Devnet** (both). Local (anvil + solana-test-validator) is the lab; Sepolia + Devnet is the public v1 acceptance milestone.  
**Warning:** lab on local/test networks only. Not production, not real assets, not legal advice.

---

## 1. Objective (summary)

End-to-end design from the European legal-title article:

- **Title lives on Ethereum** (ERC-3643-style registry: verified holders, transfer rules, expiring attestations, hash-chained ledger, court orders).
- **Representation lives on Solana** (Token-2022 mint + transfer hook + permanent delegate).
- **Relayer quorum bridge** (2-of-3 in v1); **Ethereum is source of truth** (D1).
- **DvP escrow on Solana**; Ethereum decides; deadlines D4–D6.
- Frontend (roles + public explorer + bridge monitor); REDTEAM / EXTATK / QA; close only with evidence on **both** testnets.

v1 asset class: **bonded warehouse wine**. Other classes out of scope.

---

## 2. Design decisions D1–D14 (closed 2026-11-17)

| # | Decision |
|---|----------|
| D1 | Ethereum commands; Solana balances change only via Eth-approved messages |
| D2 | Holders identified on Eth by Solana pubkey (`bytes32`) |
| D3 | Full DvP on Solana; Eth only decides |
| D4 | Eth approves only before `deadline` (own clock) |
| D5 | Solana does not unilateral-refund before `hardDeadline` (= deadline + 7d) |
| D6 | Late approval after hardDeadline → Solana rejects; reconciler + operator fix (tested) |
| D7 | No cross-chain message may change relayers/threshold/roles/code |
| D8 | Typed messages only (`MsgType` closed enum) |
| D9 | Default message state is “unknown”; approved only after quorum |
| D10 | Threshold ≥ ⌈2n/3⌉ and n ≥ 3 |
| D11 | Signed digest includes version, chains, emitter, relayer epoch |
| D12 | Per-asset flow limits (24h window + per-transfer) + guardian pause |
| D13 | Distinct roles; deploy checks overlap |
| D14 | Frontend is not truth; addresses from `shared/` only (never URL) |

---

## 3. Phase board (current)

| Phase | Name | Status | Authorization |
|-------|------|--------|---------------|
| **BOOT** | Scaffold Foundry + Anchor + relayer | ✅ Closed | ✅ 2026-11-17 |
| **CODEC** | Message format + golden vectors | ✅ Closed | ✅ 2026-11-17 |
| **TITLE** | TitleRegistry + Identity + compliance + ledger | ✅ Closed | ✅ 2026-11-17 |
| **ATTEST** | Attestations + role separation | ✅ Closed | ✅ 2026-11-18 |
| **ENDPOINT** | BridgeEndpoint quorum / ids / flow / pause / rotate | ✅ Closed | ✅ 2026-11-18 |
| **MIRROR** | Anchor title_mirror + Token-2022 + hook | ✅ Closed | ✅ 2026-11-18 |
| **DVP** | Escrow + decisions + D4–D6 | ✅ Closed | ✅ 2026-11-18 |
| **COURT** | Forced transfer, reconcile, redeem | ✅ Closed | ✅ 2026-11-19 |
| **RELAY** | Relayers + reconciler + read-only API | ✅ Closed | ✅ 2026-11-19 |
| **E2E** | Local stack + lifecycle + induced failures | ✅ Closed | ✅ 2026-11-19 |
| **FRONT** | Next.js views | ✅ Closed | ✅ 2026-11-19 |
| **REDTEAM** | R/P/W + mutation + static analysis | ✅ Closed | ✅ 2026-11-20 |
| **QA** | Simulated-human QA | ✅ Closed | ✅ 2026-11-20 |
| **EXTATK** | X1–X36 external attacker agent | ✅ Closed | ✅ 2026-11-20 · 0 `roto` |
| **TESTNET** | Sepolia + Devnet evidence | ✅ Closed | ✅ 2026-11-23 · `DEPLOY-TESTNET-ES.md` |
| **SOLV** | Invariants, gas, SWC-AUDIT, EN docs, portfolio | ✅ Closed | ✅ 2026-11-23 · `make check` green |

Fixed post-FRONT order: REDTEAM → QA → EXTATK → TESTNET → SOLV.

---

## 4. SOLV exit criteria

1. Final pass on invariants I1–I9, gas (`forge snapshot`), NatSpec.
2. `QA-ES`, `EXTATK-ES`, and `DEPLOY-TESTNET-ES` (Sepolia **and** Devnet) complete with no open blockers.
3. `SWC-AUDIT` ES/EN, `GAS` ES/EN, diagrams, EN docs, module README/portfolio.
4. Suite index updated (`../doc/README.md`: modules 01–22).
5. **Exit:** `make check` green end-to-end; both-testnet evidence present; QA and EXTATK reports closed.

Optional deferred EXTATK items X7/X15/X28 do **not** block SOLV.

---

## 5. Invariants (pointer)

Full I1–I9 coverage matrix: [INVARIANTES-EN.md](./INVARIANTES-EN.md) (from plan §8 + `test/invariant` + milestones).

---

## 6. Next step

**v1 lab closed** (BOOT→SOLV, 2026-11-23). `make check` green; Sepolia+Devnet evidence; portfolio + EN docs shipped.

**Optional post-v1:** walkthrough video; X7/X15/X28 on-chain; residual §13 items (codec/mutants).
