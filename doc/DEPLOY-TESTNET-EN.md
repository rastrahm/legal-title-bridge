# DEPLOY-TESTNET — Sepolia + Solana Devnet

> 🌐 **English** · [Español](./DEPLOY-TESTNET-ES.md)

**Date:** 2026-11-21 (UI smoke 2026-11-22 · execute+X4 + DvP UI 2026-11-23)  
**Phase:** TESTNET (authorized)  
**Warning:** lab on test networks. No real funds or legal assets.

---

## Status

| Item | Status |
|------|--------|
| Solana Devnet deploy + `initialize_config` | ✅ |
| Sepolia deploy (Identity/Attestation/Title/Bridge) | ✅ |
| Title ↔ Bridge wiring + `issue` emits `ISSUE` | ✅ |
| Eth cycle: verify → certify → createAsset → issue → `OutboundEmitted` | ✅ |
| 3 relayers status API (GET-only) | ✅ :3101–3103 |
| Frontend `NEXT_PUBLIC_NETWORK_ID=sepolia-devnet` | ✅ `.env.local` |
| Attack P1 (replay) | ✅ rejected |
| Attack R5b (non-relayer signature) | ✅ rejected |
| Attack P3 (Solana hook outside escrow) | ✅ `UnauthorizedTransferPath` on Devnet |
| `apply_issue` ISSUE Sepolia → mint Devnet | ✅ amount=1000 |
| EXTATK shortlist on testnet | ✅ X1/X17/X23/X25/X33 on-chain or D14; X4/X7/X15/X28 deferred |
| MetaMask + Phantom UI cycle | ✅ Eth on-chain + Phantom connect |
| DvP wallet on-chain (deferred signing) | ✅ Devnet escrow 2026-11-23 (C1−10 title / C2−10 Lab USD; tx `RXJ3ak1Y…`) |
| QA smoke (happy Eth + identity reject + W2) | ✅ manual 2026-11-22 (next QA: human manual) |
| `proposeRotateRelayers` (removes r3) | ✅ [`0xb86aa80c…ccf7`](https://sepolia.etherscan.io/tx/0xb86aa80cdc196ba592014d834a3655ace36eb1d77a97018ce727590c33f35fd7) · `executeAfter` ≈ 2026-11-23T11:28:12Z |
| `executeRotateRelayers` + X4 | ✅ execute [`0x40d86eb8…77d6`](https://sepolia.etherscan.io/tx/0x40d86eb8fdffba95d30ba79422c00f12e46a0594fad8b793ddb991cef65077d6) epoch=2 · X4 [`0x178cd1bc…e4d3`](https://sepolia.etherscan.io/tx/0x178cd1bc6f3ab67f5e27fa98f0c7546765729d3675d152e46d2be87c7a53e4d3) status=`0x0` (`WrongDomain`) |

Canonical: `shared/src/addresses.ts` · `shared/deployments/sepolia-devnet.json`.

---

## Sepolia

| Contract | Address |
|----------|---------|
| IdentityRegistry | `0x2525Db5706d4547B93cF2b608c9809bE2a887EE9` |
| AttestationRegistry | `0x29Ac990fBc054afab565c0270Ae324e48D70603a` |
| TitleRegistry | `0x27fE06348f6937f0f980790EC6963633f2D22F2a` |
| BridgeEndpoint | `0x577f3B58DF21357ED4F8AF6631d2017FAeE38389` |

| Evidence | Hash / value |
|----------|----------------|
| `issue` + `OutboundEmitted` (script) | [`0x8c8a9eaf…a29c`](https://sepolia.etherscan.io/tx/0x8c8a9eafe8ac22e70f4480c0aa5e3350446e6045cdfece689b21429f8518a29c) |
| messageId ISSUE | `0xad678faa8fec83d76039c4c6a7eae7b18f546fe5c61c361a28fbc19389766cf0` |
| P1 first `submitInbound` | [`0x507565a4…8736`](https://sepolia.etherscan.io/tx/0x507565a45312f3cf63cc4fa537948ead80328dbbc0640391cdc2c99725d78736) |
| P1 replay | revert (`processed=true`) |
| R5b invalid signature | revert (`InvalidQuorum`) |
| UI `registerAssertion` (MetaMask) | [`0x146532b3…2221`](https://sepolia.etherscan.io/tx/0x146532b349a8cdd39c59d372e0a08aa870d3e8e90701d065cfff3f212a672221) |
| UI `issue` (MetaMask / issuer) | [`0xa1b9b4b2…b41b`](https://sepolia.etherscan.io/tx/0xa1b9b4b2ad7daa8528b90cc4756c0c7b892e17c181c27c2c1544480cb329b41b) |

**Glamsterdam note (Sepolia):** first ETH to a new address needs ≥204 600 gas (not 21 000). Contract CREATE: ~8–20 M gas.

**Product fix on TESTNET:** `TitleRegistry.issue` now emits `MsgType.ISSUE` via `bridgeEndpoint` (previously it did not leave for the bridge).

---

## Solana Devnet

| Field | Value |
|-------|-------|
| Program id | `2DvHn2Hxj3HFsbn2iDuBGL4TQAzTomcVCsDTPoZ2h1JL` |
| Deploy | `3p6c8VYq3Frt98aSPNuyHPywXos5RKWgg2wBZcY4mhq7nEEx3uP1wRzEDQpzF5vtT3r2TZKncz1caDASh5DN7bLn` |
| Config PDA | `A9j9D6XGUC94SLcpGhK8AyCJReyVu6oGKdD1QRdDm4KU` |
| `initialize_config` | `5D8wpCxE9KPtyEzrthXqDDW7p6gsK23KEY6wTB2vMHLGnZ9Rqd4KBQDPyeFVdBrajmRrnrUUH8wLKEn4ux1wzSx1` |
| Mint (ISSUE mirror) | `6HDbgKmdmoBhLjfVNciZiV4tVYDqyTL3LK9Ei6qtQZMU` |
| `apply_issue` | `4LJ1jKZJWcSNzQeiKa2KNweMPxsGuNFqDLoXdFzZdQexJ3b1f1QtjByi8n6MNUQES1WkF1BFx6i3TrTYgwY1tN8c` |
| Phantom (lab UI) | `EDTzyw3P2wwaLu9VyFUs5EjXziCHaSXCQkbJWhDwM4x5` |

Explorer: https://explorer.solana.com/address/2DvHn2Hxj3HFsbn2iDuBGL4TQAzTomcVCsDTPoZ2h1JL?cluster=devnet

**Redeploy 2026-11-21:** previous program id (`H4fc36…`) was closed due to lack of SOL for upgrade-buffer after fixing the secp256k1 offset parser (`eth_address_offset` read `base+2` instead of `base+3`) and accepting either a 121-byte preimage or a 32-byte digest in quorum. Config + asset were reinitialized under the new id.

---

## Relayers

| # | Address | Status |
|---|---------|--------|
| 1 | `0x56fc8EA3e005E32A9D0C73ec88c00fa925e085d0` | `http://127.0.0.1:3101/status` |
| 2 | `0xDaE72d0210A219da9628DDc952ae11Db2c9a2A06` | `http://127.0.0.1:3102/status` |
| 3 | `0x826F5Bb866862fCf2B53823Ee2652CfDb2c8D1af` | `http://127.0.0.1:3103/status` |

POST → 405 (GET only). Runner: `relayer/scripts/run-relayer-status.mjs`.

---

## UI cycle (manual, 2026-11-22)

### Ethereum (MetaMask · Sepolia)

| Step | Result |
|------|--------|
| Connect MetaMask (preferred over Phantom eth) | ✅ |
| Verifier: EIP-712 `Assertion` + `registerAssertion` | ✅ tx `0x146532b3…2221` · holder `0xbbb…bbb` |
| Asset certification + Operator `issue` | ✅ tx `0xa1b9b4b2…b41b` · asset `0xaaa…aaa` · issuer |
| Identity rejection (account without verifier role, e.g. `0xEF653C…`) | ✅ revert `InvalidSignature` (`0x8baa579f`) |
| W2 smoke: MetaMask on Mainnet → “Wrong network” banner; switch back to Sepolia | ✅ |

### Solana (Phantom · Devnet)

| Step | Result |
|------|--------|
| Connect Phantom on `/cartera` | ✅ `EDTzyw…M4x5` |
| W2 banner only if the **connected** wallet mismatches (do not require Eth on Wallet) | ✅ UX fix |
| Sell / Buy on Wallet | ✅ UI listing + offer + **Accept** → link `/cartera/firmar` → C2 sign → on-chain escrow |

ISSUE mint on Devnet applied by script (`apply_issue`); Lab USD lab mint `QfLrv6d…`; cross-PC handoff with TTL ~1 min (blockhash).

---

## Checklist

- [x] Authorized
- [x] Deploy both ends + config
- [x] Eth cycle with `OutboundEmitted`
- [x] P1 / R5b (invalid signature) with hashes
- [x] 3 read-only relayers
- [x] Frontend points to `sepolia-devnet`
- [x] P3 on-chain Devnet + apply_issue mint (see `secrets/deploy/devnet-apply-p3.json`)
- [x] MetaMask + Phantom UI cycle (Eth on-chain; Phantom connect; Wallet demo)
- [x] QA smoke: happy Eth path + identity rejection + W2 wrong network
- [x] Executable EXTATK shortlist (X1/X17/X23/X25/X33); deferred X4/X7/X15/X28 — `secrets/deploy/extatk-shortlist.json`
- [x] `proposeRotateRelayers` (r1,r2,deployer; removes r3) — tx `0xb86aa80c…ccf7` · see `secrets/deploy/r5b-propose-rotate-ok.json`
- [x] `executeRotateRelayers` → epoch 2 — tx `0x40d86eb8…77d6` · see `secrets/deploy/r5b-execute-rotate.json`
- [x] X4 epoch-1 `submitInbound` → revert (`status=0x0`) — tx `0x178cd1bc…e4d3` · see `secrets/deploy/execute-rotate-x4.json`
- [x] DvP wallet on-chain (C1→C2 handoff) — Devnet balance evidence 2026-11-23

**Minimum v1 TESTNET:** closed (execute+X4 + DvP UI). Optional deferred: X7 / X15 / X28.
