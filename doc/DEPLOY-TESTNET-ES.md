# DEPLOY-TESTNET — Sepolia + Solana Devnet

> 🌐 [English](./DEPLOY-TESTNET-EN.md) · **Español**

**Fecha:** 2026-11-21 (UI smoke 2026-11-22 · execute+X4 + DvP UI 2026-11-23)  
**Fase:** TESTNET (autorizada)  
**Advertencia:** laboratorio en redes de prueba. Sin fondos reales ni activos legales.

---

## Estado

| Ítem | Estado |
|------|--------|
| Deploy Solana Devnet + `initialize_config` | ✅ |
| Deploy Sepolia (Identity/Attestation/Title/Bridge) | ✅ |
| Cableado Title ↔ Bridge + `issue` emite `ISSUE` | ✅ |
| Ciclo Eth: verify → certify → createAsset → issue → `OutboundEmitted` | ✅ |
| 3 relayers status API (GET-only) | ✅ :3101–3103 |
| Frontend `NEXT_PUBLIC_NETWORK_ID=sepolia-devnet` | ✅ `.env.local` |
| Ataque P1 (replay) | ✅ rechazado |
| Ataque R5b (firma no-relayer) | ✅ rechazado |
| Ataque P3 (hook Solana fuera de escrow) | ✅ `UnauthorizedTransferPath` en Devnet |
| `apply_issue` ISSUE Sepolia → mint Devnet | ✅ amount=1000 |
| Shortlist EXTATK en testnet | ✅ X1/X17/X23/X25/X33 on-chain o D14; X4/X7/X15/X28 diferidos |
| Ciclo UI MetaMask + Phantom | ✅ Eth on-chain + Phantom connect |
| Cartera DvP on-chain (firma diferida) | ✅ escrow Devnet 2026-11-23 (C1−10 título / C2−10 Lab USD; tx `RXJ3ak1Y…`) |
| Smoke QA (feliz Eth + rechazo identidad + W2) | ✅ manual 2026-11-22 (próximo QA: manual humano) |
| `proposeRotateRelayers` (quita r3) | ✅ [`0xb86aa80c…ccf7`](https://sepolia.etherscan.io/tx/0xb86aa80cdc196ba592014d834a3655ace36eb1d77a97018ce727590c33f35fd7) · `executeAfter` ≈ 2026-11-23T11:28:12Z |
| `executeRotateRelayers` + X4 | ✅ execute [`0x40d86eb8…77d6`](https://sepolia.etherscan.io/tx/0x40d86eb8fdffba95d30ba79422c00f12e46a0594fad8b793ddb991cef65077d6) epoch=2 · X4 [`0x178cd1bc…e4d3`](https://sepolia.etherscan.io/tx/0x178cd1bc6f3ab67f5e27fa98f0c7546765729d3675d152e46d2be87c7a53e4d3) status=`0x0` (`WrongDomain`) |

Canónico: `shared/src/addresses.ts` · `shared/deployments/sepolia-devnet.json`.

---

## Sepolia

| Contrato | Dirección |
|----------|-----------|
| IdentityRegistry | `0x2525Db5706d4547B93cF2b608c9809bE2a887EE9` |
| AttestationRegistry | `0x29Ac990fBc054afab565c0270Ae324e48D70603a` |
| TitleRegistry | `0x27fE06348f6937f0f980790EC6963633f2D22F2a` |
| BridgeEndpoint | `0x577f3B58DF21357ED4F8AF6631d2017FAeE38389` |

| Evidencia | Hash / valor |
|-----------|----------------|
| `issue` + `OutboundEmitted` (script) | [`0x8c8a9eaf…a29c`](https://sepolia.etherscan.io/tx/0x8c8a9eafe8ac22e70f4480c0aa5e3350446e6045cdfece689b21429f8518a29c) |
| messageId ISSUE | `0xad678faa8fec83d76039c4c6a7eae7b18f546fe5c61c361a28fbc19389766cf0` |
| P1 primer `submitInbound` | [`0x507565a4…8736`](https://sepolia.etherscan.io/tx/0x507565a45312f3cf63cc4fa537948ead80328dbbc0640391cdc2c99725d78736) |
| P1 replay | revert (`processed=true`) |
| R5b firma inválida | revert (`InvalidQuorum`) |
| UI `registerAssertion` (MetaMask) | [`0x146532b3…2221`](https://sepolia.etherscan.io/tx/0x146532b349a8cdd39c59d372e0a08aa870d3e8e90701d065cfff3f212a672221) |
| UI `issue` (MetaMask / issuer) | [`0xa1b9b4b2…b41b`](https://sepolia.etherscan.io/tx/0xa1b9b4b2ad7daa8528b90cc4756c0c7b892e17c181c27c2c1544480cb329b41b) |

**Nota Glamsterdam (Sepolia):** primer ETH a dirección nueva necesita ≥204 600 gas (no 21 000). CREATE de contratos: ~8–20 M gas.

**Fix de producto en TESTNET:** `TitleRegistry.issue` ahora emite `MsgType.ISSUE` vía `bridgeEndpoint` (antes no salía al puente).

---

## Solana Devnet

| Campo | Valor |
|-------|-------|
| Program id | `2DvHn2Hxj3HFsbn2iDuBGL4TQAzTomcVCsDTPoZ2h1JL` |
| Deploy | `3p6c8VYq3Frt98aSPNuyHPywXos5RKWgg2wBZcY4mhq7nEEx3uP1wRzEDQpzF5vtT3r2TZKncz1caDASh5DN7bLn` |
| Config PDA | `A9j9D6XGUC94SLcpGhK8AyCJReyVu6oGKdD1QRdDm4KU` |
| `initialize_config` | `5D8wpCxE9KPtyEzrthXqDDW7p6gsK23KEY6wTB2vMHLGnZ9Rqd4KBQDPyeFVdBrajmRrnrUUH8wLKEn4ux1wzSx1` |
| Mint (ISSUE mirror) | `6HDbgKmdmoBhLjfVNciZiV4tVYDqyTL3LK9Ei6qtQZMU` |
| `apply_issue` | `4LJ1jKZJWcSNzQeiKa2KNweMPxsGuNFqDLoXdFzZdQexJ3b1f1QtjByi8n6MNUQES1WkF1BFx6i3TrTYgwY1tN8c` |
| Phantom (lab UI) | `EDTzyw3P2wwaLu9VyFUs5EjXziCHaSXCQkbJWhDwM4x5` |

Explorer: https://explorer.solana.com/address/2DvHn2Hxj3HFsbn2iDuBGL4TQAzTomcVCsDTPoZ2h1JL?cluster=devnet

**Redeploy 2026-11-21:** se cerró el program id previo (`H4fc36…`) por falta de SOL para upgrade-buffer tras corregir el parser de offsets secp256k1 (`eth_address_offset` leía `base+2` en lugar de `base+3`) y aceptar preimagen 121-byte o digest 32-byte en quórum. Config + asset se reinicializaron bajo el nuevo id.

---

## Relayers

| # | Address | Status |
|---|---------|--------|
| 1 | `0x56fc8EA3e005E32A9D0C73ec88c00fa925e085d0` | `http://127.0.0.1:3101/status` |
| 2 | `0xDaE72d0210A219da9628DDc952ae11Db2c9a2A06` | `http://127.0.0.1:3102/status` |
| 3 | `0x826F5Bb866862fCf2B53823Ee2652CfDb2c8D1af` | `http://127.0.0.1:3103/status` |

POST → 405 (solo GET). Runner: `relayer/scripts/run-relayer-status.mjs`.

---

## Ciclo UI (manual, 2026-11-22)

### Ethereum (MetaMask · Sepolia)

| Paso | Resultado |
|------|-----------|
| Conectar MetaMask (preferencia sobre Phantom eth) | ✅ |
| Verificador: EIP-712 `Assertion` + `registerAssertion` | ✅ tx `0x146532b3…2221` · holder `0xbbb…bbb` |
| Certificación asset + Operador `issue` | ✅ tx `0xa1b9b4b2…b41b` · asset `0xaaa…aaa` · issuer |
| Rechazo identidad (cuenta sin rol verificador, p.ej. `0xEF653C…`) | ✅ revert `InvalidSignature` (`0x8baa579f`) |
| Smoke W2: MetaMask en Mainnet → banner “Red incorrecta”; volver a Sepolia | ✅ |

### Solana (Phantom · Devnet)

| Paso | Resultado |
|------|-----------|
| Conectar Phantom en `/cartera` | ✅ `EDTzyw…M4x5` |
| Banner W2 solo si la billetera **conectada** no coincide (no exigir Eth en Cartera) | ✅ fix UX |
| Vender / Comprar en Cartera | ✅ listado UI + oferta + **Aceptar** → link `/cartera/firmar` → C2 firma → escrow on-chain |

Mint ISSUE Devnet aplicado por script (`apply_issue`); Lab USD mint lab `QfLrv6d…`; handoff cross-PC con TTL ~1 min (blockhash).

---

## Checklist

- [x] Autorizada
- [x] Deploy ambas puntas + config
- [x] Ciclo Eth con `OutboundEmitted`
- [x] P1 / R5b (firma inválida) con hashes
- [x] 3 relayers lectura
- [x] Frontend apunta a `sepolia-devnet`
- [x] P3 on-chain Devnet + apply_issue mint (ver `secrets/deploy/devnet-apply-p3.json`)
- [x] Ciclo UI MetaMask + Phantom (Eth on-chain; Phantom connect; Cartera demo)
- [x] Smoke QA: ciclo feliz Eth + rechazo identidad + W2 red incorrecta
- [x] Shortlist EXTATK ejecutable (X1/X17/X23/X25/X33); diferidos X4/X7/X15/X28 — `secrets/deploy/extatk-shortlist.json`
- [x] `proposeRotateRelayers` (r1,r2,deployer; quita r3) — tx `0xb86aa80c…ccf7` · ver `secrets/deploy/r5b-propose-rotate-ok.json`
- [x] `executeRotateRelayers` → epoch 2 — tx `0x40d86eb8…77d6` · ver `secrets/deploy/r5b-execute-rotate.json`
- [x] X4 epoch-1 `submitInbound` → revert (`status=0x0`) — tx `0x178cd1bc…e4d3` · ver `secrets/deploy/execute-rotate-x4.json`
- [x] Cartera DvP on-chain (handoff C1→C2) — evidencia saldos Devnet 2026-11-23

**TESTNET mínimo v1:** cerrado (execute+X4 + DvP UI). Diferidos opcionales: X7 / X15 / X28.
