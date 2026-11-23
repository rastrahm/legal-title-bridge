# Planning — Module 22: Legal Title Bridge (Ethereum ↔ Solana)

> 🌐 **English** · [Español](./planificacion-ES.md)

**Status:** phases BOOT→**SOLV** **closed** (2026-11-23). v1 lab accepted on Sepolia+Devnet. Board: `hitos-ES.md`.  
**Progress rule:** no phase code until *"Autorizo Fase \<ID\>"*.  
**Acceptance target:** **Ethereum Sepolia** + **Solana Devnet** (both). Local (anvil + solana-test-validator) is the lab; Sepolia + Devnet is the public v1 acceptance milestone.  
**Origin:** article “Tokenizar sin reinventar la rueda: un puente Ethereum–Solana pensado desde el derecho europeo” (2026-11-10), turned into runnable, attackable code.  
**Warning:** lab on local/test networks only. Not production, not real assets, not legal advice.

Full Spanish twin (architecture tree, threat model, §10 attack catalogs, per-phase detail): [`planificacion-ES.md`](./planificacion-ES.md).

---

## 1. Objective

End-to-end design from the European legal-title article:

- **Title lives on Ethereum** (ERC-3643-style registry: verified holders, transfer rules, expiring attestations, hash-chained ledger, court orders).
- **Representation lives on Solana** (Token-2022 mint + transfer hook + permanent delegate).
- **Relayer quorum bridge** (2-of-3 in v1); **Ethereum is source of truth** (D1) — a Solana move does not exist until inscribed on Ethereum.
- **DvP escrow on Solana**; Ethereum decides; deadlines D4–D6; both legs release together or both refund.
- **Frontend** (roles + public explorer + bridge monitor); wallets sign; addresses from `shared/` only (D14).
- **Realistic security proof** (REDTEAM with positive controls; EXTATK by a separate agent; simulated-human QA).
- **Close only with evidence on both testnets** (Sepolia + Solana Devnet), including rejected attacks with tx hashes.

v1 asset class: **bonded warehouse wine**. Other classes (land, house, vehicle, art) out of scope.

### Scope (summary)

| In (v1) | Out (v1) |
|---------|----------|
| Title / Identity / Attestation registries + BridgeEndpoint | Non-wine asset classes; EU digital ID wallet integration |
| Anchor `title_mirror` (Token-2022 hook, DvP escrow, secp256k1 quorum) | Transfer-fee / frozen-by-default extensions; light clients |
| TypeScript relayers (3 processes, threshold 2) + GET-only status API | Rust relayers; commercial messaging nets (Wormhole, CCIP, LZ) |
| Unit/fuzz/invariant, golden codec vectors, E2E, redteam, mutation, static analysis | External audit; formal verification |
| Deploy **Sepolia + Devnet** (both mandatory) with evidence | Mainnet; real funds; closing v1 with only one testnet |
| Next.js frontend (MetaMask + Phantom), ES/EN | Mobile app; permanent public hosted frontend |
| Docs ES/EN, diagrams, SWC-AUDIT, GAS, portfolio | — |

---

## 2. Design decisions D1–D14 (closed 2026-11-17)

| # | Decision | Why (short) |
|---|----------|-------------|
| D1 | **Ethereum commands.** Solana balances change only via Eth-approved messages (issue, transfer decision, court). | Single-register model (eWpG / Spanish Act 6/2023) |
| D2 | **Holders identified on Eth by Solana pubkey** (`bytes32`), bound to `IdentityRegistry`. | Token moves on Solana; registry must know whose account |
| D3 | **Full DvP on Solana.** Escrow holds both legs; Eth only decides. | Atomic settlement on one chain; bridge carries the decision |
| D4 | **Eth approves only before `deadline`** (own clock). Past deadline → `Expired`. | Avoid approving what Solana no longer expects |
| D5 | **Solana does not unilateral-refund before `hardDeadline`** (= deadline + 7d). Until then, refund only with signed `Rejected`/`Expired`. | Prevents local refund + late approval = two truths |
| D6 | Late approval after hardDeadline → Solana rejects; reconciler + operator fix with resolution hash (E2E-tested). | Declared residual risk + proven procedure |
| D7 | No cross-chain message may change relayers/threshold/roles/code; each chain governs locally with timelock. | Poly Network lesson |
| D8 | Typed messages only (`MsgType` closed enum); endpoint dispatches to fixed functions. | Poly Network lesson |
| D9 | Default message state is “unknown”; approved only after quorum. | Nomad lesson |
| D10 | Threshold ≥ ⌈2n/3⌉ and n ≥ 3, validated at deploy and each rotation. | Harmony (2-of-5) lesson |
| D11 | Signed digest includes version, chains, emitter, relayer epoch. | Replay across deploys/chains/sets |
| D12 | Per-asset flow limits (24h window + per-transfer) + guardian pause. | Caps loss if quorum compromised (Ronin) |
| D13 | Distinct roles; deploy checks overlap (`RoleOverlap`). | Role separation from the article |
| D14 | Frontend is not truth; no keys; addresses from `shared/` only (never URL); wallet signs everything. | Compromised UI ≠ compromised registry |

---

## 3. Phase board (all closed)

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

**Closed agreements (2026-11-16 / 2026-11-17):** post-FRONT order confirmed; EXTATK on testnet = mandatory subset; X1–X36 catalog fixed for v1; Solidity **`0.8.37`** (Cancun); **D1–D14 accepted**. Ops board: `doc/hitos-ES.md`.

### SOLV exit criteria (met 2026-11-23)

1. Final pass on invariants I1–I9, gas (`forge snapshot`), NatSpec.
2. `QA-ES`, `EXTATK-ES`, and `DEPLOY-TESTNET-ES` (Sepolia **and** Devnet) complete with no open blockers.
3. `SWC-AUDIT` ES/EN, `GAS` ES/EN, diagrams, EN docs, module README/portfolio.
4. Suite index updated (`../doc/README.md`: modules 01–22).
5. **Exit:** `make check` green end-to-end; both-testnet evidence present; QA and EXTATK reports closed.

Optional deferred EXTATK items X7/X15/X28 do **not** block SOLV.

---

## 4. Invariants I1–I9 (summary)

| ID | Invariant | Where checked |
|----|-----------|---------------|
| I1 | Per asset: sum of registry balances = units issued − redeemed | Foundry invariant |
| I2 | Per asset: Solana mint supply = Ethereum registry units | Reconciler; after each E2E scenario |
| I3 | Each message id applied at most once, on each chain | Foundry invariant + Anchor + E2E duplicate delivery |
| I4 | Each request ends in exactly one terminal state: `Completed` or `Refunded` (never both, never back to `Pending`) | Foundry + Anchor + E2E |
| I5 | No Solana title token changes owner outside: escrow, decision release, or permanent delegate (court) | Hook tests, all transfer paths |
| I6 | Payment is conserved: ends with seller or returns to buyer | Anchor + E2E |
| I7 | Never approve with expired certification or unverified holder | Foundry fuzz + invariant |
| I8 | Threshold ≥ ⌈2n/3⌉ and n ≥ 3 at all times | Foundry invariant over rotations |
| I9 | Ledger chain continuous: each `entryHash` links to previous | Foundry invariant |

Full coverage matrix: [INVARIANTES-EN.md](./INVARIANTES-EN.md).

---

## 5. Architecture (compact)

| Artifact | Responsibility |
|----------|----------------|
| `TitleRegistry` | Units per asset/holder (`bytes32`), transfer rules, states, requests/decisions, issue, court, reconcile, chained entries |
| `IdentityRegistry` | Verifier assertions (country, investor type, expiry) EIP-712 |
| `AttestationRegistry` | Existence + registry certs with expiry; quorum for issuance |
| `BridgeEndpoint` | Quorum, message ids, flow limits, `MsgType` dispatch, outbound emit |
| `title_mirror` | Config, relayer set, Token-2022 mint/hook, DvP escrow, permanent delegate |
| Relayer | Watch both chains, finality, sign, collect quorum, deliver, reconcile; GET `/status` `/messages` only |
| Frontend | Read chains; build txs for wallet signing by role; explorer recalculates ledger hashes in-browser |

### MsgType (closed enum)

| `MsgType` | Direction | Effect |
|-----------|-----------|--------|
| `ISSUE` | Eth → Sol | Mint N tokens to issuer matching registry units |
| `TRANSFER_REQUEST` | Sol → Eth | Register request (seller, buyer, amounts, payment mint, `deadline`, …) |
| `TRANSFER_DECISION` | Eth → Sol | `Approved` / `Rejected(reason)` / `Expired` |
| `FORCED_TRANSFER` | Eth → Sol | Move via permanent delegate with court resolution hash |

Stack constraints (suite): Solidity `0.8.37` Cancun, OZ v5, Foundry fuzz/invariant floors, Anchor `0.31.1`, Node 22, Next.js 16 / React 19 / Tailwind 4. Details: ES §3.

---

## 6. Acceptance checklist §13 (v1)

- [ ] Codec identical in Solidity, Rust, and TypeScript (golden vectors)
- [ ] Title registry with identity, rules, expiring certifications, chained entries
- [ ] Bridge with quorum ≥ ⌈2n/3⌉, epoch domain, unique ids, flow limits, pause
- [ ] Token-2022 mint moves only via authorized flow (hook) and court (permanent delegate)
- [ ] Atomic DvP on Solana with deadlines D4–D6
- [ ] Invariants I1–I9 covered
- [x] Incidents R1–R7 reproduced with positive control and rejected by real code (REDTEAM 2026-11-20)
- [x] Attacks P1–P9 and failures F1–F5 covered (P in REDTEAM; F1–F5 in E2E)
- [ ] Mutants M1–M10 detected
- [ ] Format and linter in `make check` and pre-commit, no findings without justified exceptions
- [ ] Static and dependency analysis without unjustified findings
- [x] Frontend with explorer, wallet, operator, verifier, bridge monitor, ES/EN
- [x] Frontend attacks W1–W6 covered; production build without test code (`check-bundle` C17)
- [x] QA phase: 6 personas and 10 scripts covered; zero open blockers (`doc/QA-ES.md`)
- [x] EXTATK phase: X1–X36 by separate attacker agent; zero `roto` (`doc/EXTATK-ES.md`)
- [x] Full UI cycle on **Sepolia and Solana Devnet** (both), with hashes (TESTNET 2026-11-23)
- [x] Attacks rejected on **both** testnets (P1, R5b, P3 + EXTATK subset), with hashes · X7/X15/X28 deferred optional
- [x] Docs ES/EN, SWC-AUDIT, GAS, diagrams, and portfolio (SOLV 2026-11-23; walkthrough video optional)

Unchecked residual items (codec/mutants/lint/static as listed) are optional post-v1 hardening of §13; they do **not** reopen phases.

Security catalogs (R/P/F/W/M/X, checks C0–C17): see ES §9–§10 and `RED-TEAM-ES.md` / `EXTATK-ES.md` / `QA-ES.md`.

---

## 7. Next steps

**v1 lab closed** (BOOT→SOLV, 2026-11-23). Board: [`doc/hitos-ES.md`](./hitos-ES.md).

**Done:** `make check` green; Sepolia+Devnet evidence; QA/EXTATK/DEPLOY; GAS/SWC/INVARIANTES; portfolio/; EN docs + diagrams.

**Optional post-v1:** walkthrough video; X7/X15/X28 on-chain; residual §13 items (codec/mutants/static) if further hardening is desired.
