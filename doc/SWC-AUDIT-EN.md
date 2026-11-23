# Static audit (C4) — justifications

> 🌐 **English** · [Español](./SWC-AUDIT-ES.md)

**Tools:** Slither 0.11.6 (`slither . --exclude-dependencies --filter-paths 'lib/|test/'`), Aderyn 0.6.8 (`aderyn .`), `cargo audit` (`solana/` workspace), `npm audit --omit=dev` in `shared` / `relayer` / `frontend`.

**Date:** 2026-11-20 · REDTEAM phase · branch `redteam`

## Summary

| Source | High | Medium | Action |
|--------|------|--------|--------|
| Slither | 1 | 4 | Justified below (false positives / design) |
| Aderyn | 3 | — (Low separate) | Justified below |
| cargo audit (`solana/`) | 0 vulns | 3 warnings (unmaintained/unsound transitive: bincode, libsecp256k1, rand) | Accepted: from Anchor/Solana 0.31 / Agave stack; no upstream fix in v1 lab |
| npm audit | 0 | 0 | No production vulnerabilities |

## Slither

### High — `uninitialized-state` on `TitleRegistry._entryHashes`

**Verdict:** false positive. It is a `mapping` of dynamic arrays; default storage is empty and is filled only via `_appendEntry`. No constructor initialization is required.

### Medium — `uninitialized-local` in `RelayerQuorum.verify` (`valid`)

**Verdict:** acceptable. `uint256 valid` is incremented only in the loop; the initial value 0 is the correct count.

### Medium — `unused-return` in `forcedTransfer` / `redeemInKind` / `decide` → `emitOutbound`

**Verdict:** design. The outbound `messageId` is emitted in the `OutboundEmitted` event; the on-chain caller does not need the return value. The relayer indexes logs, not the return value.

## Aderyn

### H-1 — Reentrancy: state change after external call

**Verdict:** false positive / correct CEI on `decide` and registry paths. Request state (`Approved` / `Rejected` / `Expired`) is written **before** `bridgeEndpoint.emitOutbound`. `emitOutbound` does not callback into `TitleRegistry`. Positive control P5 (`VulnerableTitleDecide`) demonstrates the anti-pattern and the safe CEI pattern.

### H-2 — Storage array edited with memory

**Verdict:** acceptable. In `proposeRotateRelayers`, calldata is copied to `memory` and then to storage in `PendingRotation`; storage is not edited through an incorrect memory alias.

### H-3 — Weak randomness

**Verdict:** false positive. The protocol does not use on-chain randomness for security; there is no `block.prevrandao` / `timestamp` as a privilege entropy source.

## Low / informational

Centralization (admin/guardian/operator/court roles), compliance loops, and literals: accepted in the v1 lab (D7 local governance, small n). They do not block C4.

## C4 criterion

Zero High/Medium findings **without justification**. This document is the justification required by the plan.
