# Class diagram — Legal Title Bridge (Ethereum ↔ Solana)

> 🌐 **English** · [Español](./diagrama-de-clases-ES.md)

**Canonical Mermaid / class map:** [`diagrama-de-clases-ES.md`](./diagrama-de-clases-ES.md).

| Layer | Components |
|-------|------------|
| Ethereum | `TitleRegistry`, `IdentityRegistry`, `AttestationRegistry`, `BridgeEndpoint` (+ FlowLimiter, RelayerQuorum, MessageIdSet) |
| Solana | Anchor `title_mirror`: config, asset, Token-2022 mint + transfer hook, DvP escrow PDAs |
| Relayer | Watcher → finalize → sign → submit; SQLite idempotency; GET-only status API |
| Frontend | Next.js 16 App Router: explorer, cartera, operador, verificador, puente |

Stack: Solidity `0.8.37` Cancun · OZ v5 · Anchor `0.31.1` · Node 22.
