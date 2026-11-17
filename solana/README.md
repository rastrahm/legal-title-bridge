# Solana Title Mirror

Anchor workspace for the `title_mirror` program.

This BOOT scaffold pins Anchor 0.31.1, declares Token-2022 support through
`anchor-spl`, and exposes two minimal instructions:

- `initialize`: smoke initialization hook with no persistent state yet.
- `ping`: no-op smoke instruction that returns `Ok(())`.

The Cargo feature `redteam` is reserved for intentionally vulnerable variants in
later phases.
