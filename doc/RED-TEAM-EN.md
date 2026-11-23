# Red team — results (C11 / C12 / C4 / C16)

> 🌐 **English** · [Español](./RED-TEAM-ES.md)

**Phase:** REDTEAM · **Branch:** `redteam` · **Date:** 2026-11-20  
**Rule:** each attack wins first against a vulnerable variant (positive control) and fails against real code with the expected error (§10.1).

**Close-out command:** `make check-redteam`

---

## Matrix R1–R7 (real incidents)

| ID | Incident | Vulnerable (success) | Real (rejection) | Files |
|----|----------|----------------------|------------------|-------|
| R1 | Poly Network | `MSG_SET_RELAYERS` + `rotateDirect` changes the set | `UnsupportedMsgType`; epoch/relayers intact | `test/redteam/R_Incidents.t.sol`, `vulnerable/VulnerableBridgeEndpoint.sol` |
| R2 | Qubit | `setTitleRegistry(EOA)` without `code.length` | `EmptyCode` | same |
| R3 | Wormhole | `require_instructions_sysvar_vulnerable` OK with fake key (`--features redteam`) | `require_instructions_sysvar` + Anchor constraint; TS R3 | `solana/.../quorum.rs`, `solana/tests/title_mirror.ts` |
| R4 | Cashio | (fake account / mint) — real via TS I5/R4 | `MintMismatch` / constraints | `title_mirror.ts` |
| R5a | Ronin k−1 | inbound without quorum (`requireQuorum=false`) | `InvalidQuorum` | `R_Incidents.t.sol` |
| R5b | Old relayer/epoch | `skipEpochCheck` | `WrongDomain` | same |
| R5c | Drain with k | `drained` without cap; pause does cut | `FlowLimitExceeded` / `Paused`; loss ≤ window | same |
| R6 | Harmony 2-of-5 | vulnerable constructor with threshold 2/5 | `ThresholdTooLow` deploy/rotation | same + `quorum.rs` |
| R7 | Nomad default-ok | accept without signatures | `InvalidQuorum`; id not marked | same |

## Matrix P1–P9 (protocol)

| ID | Attack | Vulnerable | Real | Files |
|----|--------|------------|------|-------|
| P1 | Replay messageId | unmarked double apply | `MessageAlreadyProcessed` | `P_Protocol.t.sol`, `e2e/redteam` |
| P2 | Cross-domain / epoch | skip epoch | `WrongDomain` | `P_Protocol.t.sol` |
| P3 | Transfer outside escrow | `require_authorized_path_vulnerable` | `UnauthorizedTransferPath` | `hook.rs` + TS I5 |
| P4 | Refund/approve race | — | F4/D6 in e2e (divergence detected + reconcile) | `e2e/redteam`, `failures.test.ts` |
| P5 | Payment reentrancy | `payThenFinalize` reenters | CEI `payThenFinalizeSafe` (Eth v1 without payment ERC20; demo in vulnerable) | `VulnerableTitleDecide.sol` |
| P6 | Buyer without identity | `decideBlind` | `Rejected` + `NOT_VERIFIED` | `P_Protocol.t.sol` |
| P7 | Order + escrow | — | `COURT_ROLE` + `Court.t.sol` / Solana `apply_forced_p7` | unit Court + mirror |
| P8 | Invalid amounts | — | `ZeroAmount` | `P_Protocol.t.sol` |
| P9 | Third-party refund | — | TS DVP: refund pays owners | `title_mirror.ts` |

## Matrix W1–W6 (frontend)

Covered in FRONT (C16): `frontend/e2e/attacks-w.spec.ts` + `frontend/e2e/vulnerable/xss-name.html` (W1). Re-run in `make check-redteam`.

| ID | Result |
|----|--------|
| W1 | XSS escaped; vulnerable HTML executes |
| W2 | Network banner + buttons disabled |
| W3 | `?endpoint=` / `?program=` ignored (D14) |
| W4 | Confirmation from decoded tx |
| W5 | `frame-ancestors 'none'` + `X-Frame-Options: DENY` |
| W6 | Relayer data does not override chain truth |

## Mutation M1–M10 (C12)

`scripts/mutate.sh` — **10/10 mutants killed** (2026-11-20).

| M | Control removed | Killing test |
|---|-----------------|--------------|
| M1 | Mark messageId | `test_P1_DuplicateMessageId` |
| M2 | Epoch in domain | `test_R5b_RemovedRelayerWrongEpoch` |
| M3 | Deadline in decide | `test_DecideExpired_D4` |
| M4 | Certification | `test_DecideRejectedCertExpired` |
| M5 | Buyer identity | `test_P6_DecideRejected_NotVerified` |
| M6 | Flow limit | `test_R5c_FlowLimitAndPause` |
| M7 | ⌈2n/3⌉ | `test_R6_DeployThresholdTooLow` |
| M8 | Instructions sysvar | `r3_real_rejects_fake_sysvar_key` |
| M9 | `token::mint` payment | assert source request_transfer |
| M10 | Hook authority | `allows_delegate_and_escrow` |

## Static analysis (C4)

See [`SWC-AUDIT-EN.md`](./SWC-AUDIT-EN.md). High/Medium justified; npm audit clean; transitive `cargo audit` warnings documented.

## Attacker capabilities (declared)

| Scenario | Capability |
|----------|------------|
| R1/R7/P1/P2 | Public + wire/signature crafting |
| R5a | k = threshold − 1 |
| R5b | Prior-epoch / old-set signatures |
| R5c | k = threshold (2 of 3) + drain measurement |
| R6 | Malicious deploy/rotation |
| R2 | Admin or deceived config path |
| R3/R4/P3 | Fake accounts / fake sysvar / fake mint |
| W* | Browser + DOM / URL / iframe / lying relayer API |

## Exit criterion

- [x] C11 — `forge test --match-path 'test/redteam/*'` + `cargo test -p title_mirror --features redteam` + `vitest run redteam`
- [x] C12 — `scripts/mutate.sh`
- [x] C4 — slither/aderyn + this SWC
- [x] C16 — Playwright W1–W6 (re-check in `make check-redteam`)
