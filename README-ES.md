# Legal Title Bridge — Módulo 22

Puente Ethereum ↔ Solana para títulos legales (vino en depósito fiscal, v1). Laboratorio en redes locales y de prueba (**Sepolia** + **Solana Devnet**). No es producción ni asesoramiento legal.

## Estado

- Planificación y D1–D14: cerradas.
- Fase **BOOT**: en curso (rama `git` `boot`).
- Autorización: no se codea una fase sin `Autorizo Fase <ID>`.

## Stack (anotado en BOOT · 2026-11-17)

| Pieza | Versión |
|-------|---------|
| Solidity / solc | **0.8.37** (Cancun) |
| Foundry | forge **1.5.1-stable** (`~/.foundry/bin`) |
| OpenZeppelin | **v5.2.0** |
| Anchor | **0.31.1** |
| Solana CLI | **2.2.20** (Agave) |
| Cargo | 1.96.0-nightly (host) |
| Node / npm | **v22.22.2** / 10.9.7 (`.nvmrc`) |
| Next.js / React / Tailwind | 16.4.6 / 19.3 / 4.x |
| slither | **0.11.6** (`pipx`) |
| cargo-audit | **0.23.0** |
| Playwright | **1.65.1** + Chromium (en `frontend/`) |
| aderyn | **0.6.8** (Cyfrin git) |

> Nota PATH: el `forge` de nvm **no** es Foundry. Usar `export PATH="$HOME/.foundry/bin:$PATH"`.

## Quickstart

```bash
export PATH="$HOME/.foundry/bin:$PATH"
nvm use 22
cp .env.example .env
make hooks          # pre-commit
make check-boot     # C0 + builds + tests de humo
```

## Docs

- [`doc/planificacion-ES.md`](doc/planificacion-ES.md)
- [`doc/hitos-ES.md`](doc/hitos-ES.md)
- [`doc/casos-de-uso-ES.md`](doc/casos-de-uso-ES.md) — situaciones UC-01…UC-16
- [`doc/manual-de-ayuda-ES.md`](doc/manual-de-ayuda-ES.md) — pasos por pantalla
- Diagramas y mapas de ataque en `doc/`

## Remotos

- GitHub: `github` → `rastrahm/legal-title-bridge`
- GitLab: `gitlab` → `rastrahm/legal-title-bridge`
