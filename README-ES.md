# Legal Title Bridge — Módulo 22

Puente Ethereum ↔ Solana para títulos legales (vino en depósito fiscal, v1). Laboratorio en redes locales y de prueba (**Sepolia** + **Solana Devnet**). No es producción ni asesoramiento legal.

## Estado (v1 lab · 2026-11-23)

| Fase | Estado |
|------|--------|
| BOOT → **SOLV** | ✅ Cerradas |
| D1–D14 | ✅ Cerradas |
| `make check` | ✅ Verde |

Autorización: no se codea una fase sin `Autorizo Fase <ID>`.

## Stack

| Pieza | Versión |
|-------|---------|
| Solidity / solc | **0.8.37** (Cancun) |
| Foundry | forge **1.5.1-stable** (`~/.foundry/bin`) |
| OpenZeppelin | **v5.2.0** |
| Anchor | **0.31.1** |
| Solana CLI | **2.2.20** (Agave) |
| Node / npm | **v22** (`.nvmrc`) |
| Next.js / React / Tailwind | 16 / 19 / 4.x |

> Nota PATH: el `forge` de nvm **no** es Foundry. Usar `export PATH="$HOME/.foundry/bin:$PATH"`.

## Quickstart

```bash
export PATH="$HOME/.foundry/bin:$PATH"
nvm use 22
cp .env.example .env
make hooks
make check          # gate completo (incluye EXTATK)
```

Testnet lab: ver [`doc/DEPLOY-TESTNET-ES.md`](doc/DEPLOY-TESTNET-ES.md) y `NEXT_PUBLIC_NETWORK_ID=sepolia-devnet` en `frontend/.env.local`.

## Docs

| Doc | Contenido |
|-----|-----------|
| [`doc/planificacion-ES.md`](doc/planificacion-ES.md) / [EN](doc/planificacion-EN.md) | Plan y fases |
| [`doc/hitos-ES.md`](doc/hitos-ES.md) | Tablero operativo |
| [`doc/INVARIANTES-ES.md`](doc/INVARIANTES-ES.md) / [EN](doc/INVARIANTES-EN.md) | I1–I9 |
| [`doc/GAS-ES.md`](doc/GAS-ES.md) / [EN](doc/GAS-EN.md) | Hot paths + snapshot |
| [`doc/SWC-AUDIT-ES.md`](doc/SWC-AUDIT-ES.md) / [EN](doc/SWC-AUDIT-EN.md) | Estático C4 |
| [`doc/DEPLOY-TESTNET-ES.md`](doc/DEPLOY-TESTNET-ES.md) | Evidencia Sepolia + Devnet |
| [`doc/manual-de-ayuda-ES.md`](doc/manual-de-ayuda-ES.md) | UI paso a paso |
| [`portfolio/`](portfolio/) | Landing portfolio (ES/EN) |

Capturas UI: `doc/front-screenshots/`. Video walkthrough: pendiente (las capturas cubren el tour v1).

## Remotos

- GitHub: `github` → `rastrahm/legal-title-bridge`
- GitLab: `gitlab` → `rastrahm/legal-title-bridge`
