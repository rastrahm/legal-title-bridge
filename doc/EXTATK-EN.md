# EXTATK — Deep Attack Report X1–X36

> 🌐 **English** · [Español](./EXTATK-ES.md)

**Date:** 2026-11-20  
**Agent:** external attacker (independent gray/black-box perspective)  
**Target stack:** Legal Title Bridge v1 — production code in `src/`, `solana/programs/title_mirror/src/`, `shared/`, `e2e/src/`, `frontend/src/`  
**Restrictions:** no access to `test/redteam/`, `doc/RED-TEAM-EN.md`, or C11 assertions.  
**Summary:** 36 attacks attempted; **0 broken**, **34 blocked**, **2 partial** (by design).

---

## Results table X1–X36

| ID | Attack | Attacker capability | Observed effect | Defense mechanism | Verdict | Evidence source |
|----|--------|---------------------|-----------------|-------------------|---------|-----------------|
| X1 | Swapped `srcChain`/`dstChain` | Already-emitted public signatures | `WrongDomain` revert | `_requireInboundDomain`: `packet.dstChain != LOCAL_CHAIN_ID` | **blocked** | `test/extatk/X01_X08_BridgeDomain.t.sol::test_X1_swappedDomains_revertWrongDomain` |
| X2 | Mutilate one payload byte after signing | Signatures + intercepted wire | `InvalidQuorum` revert | `messageIdOfWire = keccak256(wire)` binds payload to digest | **blocked** | `test/extatk/X01_X08_BridgeDomain.t.sol::test_X2_mutatedPayload_revertInvalidQuorum` |
| X3 | Same `messageId` with different `MsgType` re-delivered | Signatures + mempool | `MessageAlreadyProcessed` | `MessageIdSet.add` marks id before effects (I3/CEI) | **blocked** | `test/extatk/X01_X08_BridgeDomain.t.sol::test_X3_replayWithDifferentMsgType_revertAlreadyProcessed` |
| X4 | Prior-epoch signatures on Ethereum BridgeEndpoint | 1 removed relayer + epoch-1 signatures | `WrongDomain` revert | `packet.epoch != endpoint.epoch` in `_requireInboundDomain` | **blocked** | `test/extatk/X01_X08_BridgeDomain.t.sol::test_X4_oldEpochAfterRotation_revertWrongDomain` |
| X5 | k−1 valid signatures + 1 non-relayer key signature | k−1 keys | `InvalidQuorum` | `RelayerQuorum.verify`: signer not in set → false | **blocked** | `test/extatk/X01_X08_BridgeDomain.t.sol::test_X5_belowThresholdWithNonRelayer_revertInvalidQuorum` |
| X6 | Two coalitions deliver the same message in parallel | k = threshold in two coalitions | 2nd delivery: `MessageAlreadyProcessed` | `MessageIdSet` blocks second `add` | **blocked** | `test/extatk/X01_X08_BridgeDomain.t.sol::test_X6_doubleDeliveryRace_secondReverts` |
| X7 | ISSUE message with amount fragmented in N below the cap | k = threshold | `FlowLimitExceeded` when window exhausted | `FlowLimiter.checkAndConsume`: accumulates consumption in 24 h window | **blocked** | `test/extatk/X01_X08_BridgeDomain.t.sol::test_X7_flowWindowFragmentation_revertFlowLimit` |
| X8 | Inbound or outbound submit while bridge paused | Guardian + k = threshold | `Paused` revert both directions | `if (paused) revert BridgeErrors.Paused()` in `submitInbound` and `emitOutbound` | **blocked** | `test/extatk/X01_X08_BridgeDomain.t.sol::test_X8_submitWhilePaused_revertPaused` and `test_X8_emitOutboundWhilePaused_revertPaused` |
| X9 | EIP-712 assertion with wrong `chainId` (fork) | Fork/local verifier key | `InvalidSignature` revert | EIP-712 domain separator includes real chainId; mismatch → recovered signer ≠ verifier | **blocked** | `test/extatk/X09_X13_Identity.t.sol::test_X9_wrongChainIdAssertion_revertInvalidSignature` |
| X10 | Certification expires between TRANSFER_REQUEST and `decide()` | Clock + certifier | `Rejected` decision with reasonCode=2 | `attestationRegistry.isCertified` re-evaluated in `decide()` → `CERTIFICATION_EXPIRED` | **blocked** | `test/extatk/X09_X13_Identity.t.sol::test_X10_certExpiredBeforeDecide_rejectWithCertExpired` |
| X11 | Verified buyer loses identity (revocation) before `decide()` | Verifier + buyer | `Rejected` decision with reasonCode=1 | `identityRegistry.isVerified(req.buyer)` re-evaluated in `decide()` → `NOT_VERIFIED` | **blocked** | `test/extatk/X09_X13_Identity.t.sol::test_X11_buyerRevokedBeforeDecide_rejectNotVerified` |
| X12 | Certifier signs twice; another does not sign | Issuer + 1 certifier | `isCertified` = false; `issue()` → `CertificationExpired` | `AttestationRegistry.liveCount` counts distinct addresses; 1/2 < threshold=2 | **blocked** | `test/extatk/X09_X13_Identity.t.sol::test_X12_certifierDoubleSign_quorumNotMet` |
| X13 | `Frozen` asset with `Pending` request | Operator / court | `Rejected` decision with reasonCode=3 (Frozen) or 4 (Paused) | `_evaluateApproval` checks `assetState` at `decide()` time | **blocked** | `test/extatk/X09_X13_Identity.t.sol::test_X13_frozenAssetWithPendingRequest_rejectAssetFrozen` and `test_X13b` |
| X14 | Lying RPC reorders/inserts ledger-chain entries | Own RPC or local mitm | `verifyLedgerChain` detects `breakAt` and returns `ok=false` | Chained hash `keccak256(prevHash ‖ data)`; any reorder or injection breaks the chain | **blocked** | `e2e/extatk/x14-x32.test.ts::X14` (3 cases) |
| X15 | Approval arrives exactly at `hardDeadline`; refund in same slot | Buyer + slow relayers | Late approval → `LateApprovalRejected`; refund → `Refunded` | `dvp::require_approved_before_hard_deadline(now, hard_deadline)` on Solana | **blocked** | `e2e/extatk/x14-x32.test.ts::X15` |
| X16 | `refund_after_hard_deadline` invoked by third party | Anyone | Refund executed; funds go to seller (title) and buyer (payment), not caller | Destination accounts hardcoded in PDA: `seller_title_ata.owner == escrow.seller` (P9) | **blocked** | `e2e/extatk/x14-x32.test.ts::X16` |
| X17 | Payment deposit with mint different from request | Malicious buyer | `MintMismatch` revert on Solana | Anchor constraint: `payment_mint.key() == escrow.payment_mint @ MirrorError::MintMismatch` | **blocked** | `e2e/extatk/x14-x32.test.ts::X17` + `e2e/extatk/x22-x27-solana-evidence.ts` |
| X18 | Partial deposit: fewer tokens than required | Holder/buyer | `registerRequest` throws `insufficient sol balance` if balance < amount | Validation in `registerRequest`: `if (bal < req.amount) throw` | **blocked** | `e2e/extatk/x14-x32.test.ts::X18` |
| X19 | Seller cancellation after buyer deposit (different orderings) | Both | Correct refund (hardDeadline) or P7 cancellation (court) | `refundAfterHardDeadline` + `forcedTransfer` with P7 → `CourtCancelled` | **blocked** | `e2e/extatk/x14-x32.test.ts::X19` |
| X20 | D6 reconciliation applied twice with same hash | Compromised operator | 2nd call → `RequestNotApproved` revert | `req.status != RequestStatus.Approved` before reconcile; status becomes `Reconciled` after 1st | **blocked** | `test/extatk/X20_X21_Reconcile.t.sol::test_X20_doubleReconcile` + `e2e/extatk/x14-x32.test.ts::X20` |
| X21 | Reconciliation with empty hash (`bytes32(0)`) or no anchor | Compromised operator | `ZeroAddress` revert (empty hash) or `RequestNotApproved` (wrong status) | `if (resolutionHash == bytes32(0)) revert ZeroAddress()` | **blocked** | `test/extatk/X20_X21_Reconcile.t.sol::test_X21_reconcileZeroHash` + `test_X21b` |
| X22 | Swap instruction accounts for another owner same layout (Cashio) | Attacker program | Anchor `ConstraintSeeds` revert | Each PDA: `seeds=[…], bump=account.bump`; deterministic address by (seeds, program_id) | **blocked** | `e2e/extatk/x22-x27-solana-evidence.ts::X22` |
| X23 | Fake instructions sysvar + fabricated secp256k1 instruction | Anyone | Revert by address constraint + `require_instructions_sysvar()` | `#[account(address = sysvar::instructions::ID)]` + `require_keys_eq!(info.key, INSTRUCTIONS_ID)` | **blocked** | `e2e/extatk/x22-x27-solana-evidence.ts::X23` + cargo test `r3_real_rejects_fake_sysvar_key` |
| X24 | CPI from intermediary that is not escrow (`transfer hook` bypass) | Attacker program | Hook `UnauthorizedTransferPath` revert | `hook::classify_authority` rejects any authority != permanent_delegate nor escrow_authority | **blocked** | `e2e/extatk/x22-x27-solana-evidence.ts::X24` + cargo test `allows_delegate_and_escrow` |
| X25 | Transfer with unauthorized delegate / burn / close account | Holder + auxiliary accounts | Hook rejects the transfer | same `require_authorized_path` on every Token-2022 transfer | **blocked** | `e2e/extatk/x22-x27-solana-evidence.ts::X25` |
| X26 | Recreate escrow PDA with different seeds after close | Anyone | Different address (cryptographic derivation); discriminator check on `init` | PDA = findProgramAddress(seeds, program_id); collision computationally infeasible | **blocked** | `e2e/extatk/x22-x27-solana-evidence.ts::X26` |
| X27 | Token-2022 mint with extra extensions slipped into issuance | Parallel mint issuer | `MintMismatch` revert on later instructions | Asset PDA stores `mint` pubkey in `initialize_asset`; constraint `title_mint.key() == escrow.title_mint` | **blocked** | `e2e/extatk/x22-x27-solana-evidence.ts::X27` |
| X28 | Deep reorg on anvil/local chain before confirmations | Local node control | Message never stored nor delivered | `RelayerFleet.observe`: only inserts when `head - emittedAt >= confirmations` | **blocked** | `e2e/extatk/x14-x32.test.ts::X28` |
| X29 | Synthetic event with same topics from cloned contract | Attacker contract | `MessageAlreadyProcessed` on second attempt | `solProcessed` set (I3); messageId = keccak256(wire) binds content | **blocked** | `e2e/extatk/x14-x32.test.ts::X29` |
| X30 | Relayer API returns false terminal states | Compromised HTTP relayer | D6 divergence detected by reconciler | Reconcile report exposes mismatch; API is read-only GET (C9); operator must act | **partial** | `e2e/extatk/x14-x32.test.ts::X30` *(see note)* |
| X31 | Relayer signs messages from emitter other than endpoint | 1 relayer key | Cannot pass domain validation on Solana | `packet.emitter == config.eth_endpoint @ MirrorError::WrongDomain` in `apply_decision.rs:139` | **blocked** | `e2e/extatk/x14-x32.test.ts::X31` |
| X32 | Exhaust flow window with own transfers (griefing) | k = threshold + capital | Third parties blocked until window resets (24 h) | Flow limit by design (D12); window always resets; no permanent loss | **partial** | `e2e/extatk/x14-x32.test.ts::X32` *(see note)* |
| X33 | Clone UI changing embedded shared/ | Cloned site | Endpoint in URL ignored; shared/ address always shown to user | `resolveAddresses`: `void searchParams` (D14); address comes from shared/ | **blocked** | `frontend/e2e/extatk-x33-x36.spec.ts::X33` |
| X34 | EIP-712 signature with fields in different order or alias types | Malicious DApp | ConfirmTxPanel shows real tx parameters, not form (W4) | `ConfirmTxPanel` decodes real tx; form values do not reach digest | **blocked** | `frontend/e2e/extatk-x33-x36.spec.ts::X34` |
| X35 | Metadata with Unicode homoglyphs and RTL override | Malicious issuer | Rendered as plain text; hex-only addresses without Cyrillic/RTL | React renders text without `dangerouslySetInnerHTML`; bytes32 are hex-only | **blocked** | `frontend/e2e/extatk-x33-x36.spec.ts::X35` |
| X36 | Deep link / query params pre-filling amounts and recipients | Third-party site / phishing | Parameters ignored; shared/ fixes addresses; ConfirmTxPanel shows real tx | D14 + W3 + W4; URL holds no keys or mnemonics | **blocked** | `frontend/e2e/extatk-x33-x36.spec.ts::X36` |

---

## Notes on `partial` items

### X30 — Relayer API returns false terminal states
- **Situation:** the relayer HTTP API is GET-only and read-only (C9). An operator who blindly trusts the API without cross-checking the chain may act on false data.
- **Existing mitigation:** the `buildReconcileReport` reconciler detects D6 divergences and exposes them. The operator must perform on-chain reconciliation manually.
- **Close-out plan:** on TESTNET, verify that D6 divergence appears in the report and that the operator can execute `reconcile()` correctly.
- **Priority:** does not block EXTATK; documented as a known operational risk.

### X32 — Flow-window griefing
- **Situation:** an actor with enough capital can exhaust the FlowLimiter 24 h window, blocking third parties during that window.
- **Existing mitigation:** the window resets every 24 h; the operator can adjust `maxPerWindow` with `setFlowLimits` (D12). No fund loss.
- **Close-out plan:** on TESTNET, verify that the window resets and that an operator can widen it.
- **Priority:** accepted as a design trade-off (D12); does not block EXTATK.

---

## Executive summary

| Verdict | Count | IDs |
|---------|-------|-----|
| **blocked** | 34 | X1–X29, X31, X33–X36 |
| **partial** | 2 | X30, X32 |
| **broken** | 0 | — |

**EXTATK criterion met:** zero `broken`; both `partial` items documented with close-out plan.

---

## TESTNET shortlist (mandatory re-run)

| ID | Re-run justification | TESTNET status (2026-11-21) |
|----|----------------------|----------------------------|
| X1 | Resubmit packet with swapped chains on real Sepolia → Devnet | ✅ blocked (`WrongDomain` / revert) — `secrets/deploy/extatk-shortlist.json` |
| X4 | Real relayer rotation + prior-epoch signature | ✅ Sepolia 2026-11-23 · execute `0x40d86eb8…` · X4 `0x178cd1bc…` status 0 (`WrongDomain`) |
| X7 | Fill flow window on-chain | ⏳ deferred (gas cost; local X7 evidence) |
| X15 | hardDeadline race with real blocks (Devnet slot timing) | ⏳ deferred (live DvP; local X15 evidence) |
| X17 | Mint substitution in real Solana instruction | ✅ blocked (mint `AccountNotInitialized` / mismatch) |
| X23 | Fake sysvar in Devnet transaction | ✅ blocked (`InvalidInstructionsSysvar`) |
| X25 | Transfer with unauthorized delegate on real token-2022 | ✅ blocked (`UnauthorizedTransferPath`) |
| X28 | Simulated Sepolia reorg with `confirmations − 1` | ⏳ deferred (local X28 evidence) |
| X33 | UI clone against TESTNET dev server (if applicable) | ✅ D14 `resolveAddresses` ignores URL |

Runner: `solana/scripts/testnet-extatk-shortlist.ts`.

---

## Evidence files

| Type | Path |
|------|------|
| Solidity (forge) | `test/extatk/X01_X08_BridgeDomain.t.sol` |
| Solidity (forge) | `test/extatk/X09_X13_Identity.t.sol` |
| Solidity (forge) | `test/extatk/X20_X21_Reconcile.t.sol` |
| E2E vitest | `e2e/extatk/x14-x32.test.ts` |
| Solana evidence | `e2e/extatk/x22-x27-solana-evidence.ts` |
| Frontend Playwright | `frontend/e2e/extatk-x33-x36.spec.ts` |
| Make target | `make check-extatk` |
