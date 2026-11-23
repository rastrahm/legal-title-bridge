# Flowchart — Legal Title Bridge

> 🌐 **English** · [Español](./diagrama-de-flujo-ES.md)

**Source of truth for Mermaid diagrams:** [`diagrama-de-flujo-ES.md`](./diagrama-de-flujo-ES.md) (ISSUE, DvP request/decide, court, reconcile D6).

English summary of decision gates:

| Flow | Key gates | Failure modes |
|------|-----------|---------------|
| `ISSUE` | roles → certified → verified holder → emit outbound | Unauthorized / cert / identity |
| Transfer request | quorum → TitleRegistry Pending | WrongDomain / InvalidQuorum / already processed |
| `decide` | I7 identity+certs → Approved/Rejected/Expired | No approve without identity/cert |
| Court / redeem | COURT_ROLE · I1 conservation | Burn path uses `to=0` on wire |
| D6 reconcile | undo Approved after Solana hardDeadline reject | Operator-only |

Companions: [`flujograma-EN.md`](./flujograma-EN.md) · [`diagrama-de-clases-EN.md`](./diagrama-de-clases-EN.md) · [`INVARIANTES-EN.md`](./INVARIANTES-EN.md).
