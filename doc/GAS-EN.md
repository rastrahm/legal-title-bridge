# Gas optimization — Legal Title Bridge (Ethereum ↔ Solana)

> 🌐 **English** · [Español](./GAS-ES.md)

Regenerate:

```bash
export PATH="$HOME/.foundry/bin:$PATH"
forge test --match-contract HotPathGasTest --gas-report
forge snapshot --match-contract HotPathGasTest
```

To refresh the full suite snapshot (hot paths + EXTATK / unit paths already tracked):

```bash
export PATH="$HOME/.foundry/bin:$PATH"
forge snapshot
# or check regressions: forge snapshot --check
```

**Baseline date:** 2026-11-23 (SOLV / docs sync)  
**Snapshot:** `.gas-snapshot` (`test/gas/HotPath.gas.t.sol` + EXTATK bridge paths)  
**Optimizer:** `optimizer_runs = 10_000`, `via_ir = true`, solc `0.8.37`, EVM Cancun (`foundry.toml`)  
**Note:** `forge snapshot --match-contract HotPathGasTest` alone rewrites `.gas-snapshot` with only those tests; merge or re-run a broader snapshot if EXTATK rows must stay.

---

## Hot-path matrix (snapshot)

| Path | Test | Gas (snapshot) | Notes |
|------|------|----------------|-------|
| `issue` | `testGas_issue` | **161 007** | Registry issue + outbound `ISSUE` (`emitOutbound` + flow consume) |
| `submitInbound` | `testGas_submitInbound` | **246 836** | Quorum verify + `MessageIdSet` mark + `TRANSFER_REQUEST` dispatch |
| `decide` | `testGas_decide` | **161 064** | Operator approve + ledger + outbound `TRANSFER_DECISION` |
| `rotate` | `testGas_rotate` | **56 433** | `executeRotateRelayers` after timelock (propose/warp in `setUp`) |
| flow limit | `testGas_flowLimitConsume` | **41 080** | Outbound `ISSUE` consuming the 24h window limiter |

### Related EXTATK / edge paths (same `.gas-snapshot`)

| Path | Gas | Notes |
|------|-----|-------|
| `test_X7_flowWindowFragmentation_revertFlowLimit` | **1 101 978** | Fragmented ISSUE until window cap (revert path) |
| `test_X4_oldEpochAfterRotation_revertWrongDomain` | **177 216** | Stale epoch after rotation |
| `test_X3_replayWithDifferentMsgType_revertAlreadyProcessed` | **298 643** | Replay / I3 |

> Prep for hot paths lives in `setUp` so Foundry’s per-test gas reflects the measured call. Numbers drift with compiler/OZ; regenerate after material `src/` changes.

---

## Applied techniques / tradeoffs

| Technique | Where | Effect / tradeoff |
|-----------|-------|-------------------|
| **CEI** | `decide`, `submitInbound`, registry mutations | State / message-id marked before external outbound; cheap fails stay cheap; Aderyn H-1 is a false positive (see SWC-AUDIT) |
| **Custom errors** | `BridgeErrors`, `RegistryErrors`, codec | Cheaper reverts than `require` strings; clearer EXTATK/REDTEAM asserts |
| **OZ v5 `AccessControl`** | Title / Identity / Attestation / Bridge | Role checks add SLOAD cost vs a single owner; required for D13 role separation |
| **`FlowLimiter` 24h window** | `BridgeEndpoint` outbound/inbound amounts | Caps Ronin-style quorum loss (D12); happy path pays window bookkeeping; fragmentation attacks pay until `FlowLimitExceeded` |
| **`optimizer_runs = 10_000` + `via_ir`** | `foundry.toml` | Favours hot-path inlining; IR compile is slower but acceptable for this module (unlike Poseidon-heavy labs) |
| **`ReentrancyGuardTransient` / CEI** | DvP / decide paths | Cancun transient lock where used; no classic guard SSTORE on the happy path |

---

## References

- [`foundry.toml`](../foundry.toml)
- [`test/gas/HotPath.gas.t.sol`](../test/gas/HotPath.gas.t.sol)
- [`.gas-snapshot`](../.gas-snapshot)
- [SWC-AUDIT-EN.md](./SWC-AUDIT-EN.md)
- [INVARIANTES-EN.md](./INVARIANTES-EN.md)
