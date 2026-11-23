# Use cases — Legal Title Bridge

> 🌐 **English** · [Español](./casos-de-uso-ES.md)

**Language:** English · Lab v1 (Sepolia + Solana Devnet / local UI).  
**Rules:** Ethereum is authoritative; the frontend is **not** on-chain truth (D14); addresses only from `shared/`.  
**Companions:** [`manual-de-ayuda-EN.md`](./manual-de-ayuda-EN.md) · [`flujograma-EN.md`](./flujograma-EN.md) · [`QA-ES.md`](./QA-ES.md).  
**UI:** «Help for this screen» panel on each view (`ContextualHelp` / `frontend/src/lib/help/content.ts`).

---

## Actors

| Actor | Wallet | Typical screens |
|-------|--------|-----------------|
| Verifier / certifier | MetaMask | `/verificador` |
| Issuer / operator / guardian / court executor | MetaMask | `/operador` |
| Holder (seller) | Phantom | `/cartera` |
| Buyer | Phantom | `/cartera` |
| Public / observer | — | `/`, `/activos`, `/puente` |
| Novice (same UI, wrong network or role) | MetaMask / Phantom | any |

---

## Situation index

| ID | Situation | Primary actor |
|----|-----------|---------------|
| UC-01 | Register holder identity (KYC) | Verifier |
| UC-02 | Certify an asset | Certifier (issuer/operator) |
| UC-03 | Issue title units | Issuer |
| UC-04 | View asset detail and ledger | Public |
| UC-05 | Sell (create DvP request) | Holder |
| UC-06 | Buy (deposit payment) | Buyer |
| UC-07 | Cancel pending sale | Holder |
| UC-08 | Rejection for identity / certification | System + UI |
| UC-09 | Deadline expiry and refund | Holder / buyer |
| UC-10 | Pause the bridge / registry | Guardian |
| UC-11 | Court order (forced transfer) | Court executor |
| UC-12 | Reconcile D6 divergence | Operator |
| UC-13 | Monitor the bridge (I2, messages) | Public |
| UC-14 | Wrong network (W2) | Novice |
| UC-15 | Account without role / invalid signature | Novice / accidental attacker |
| UC-16 | Incomplete fields on verifier | Verifier |
| UC-17 | Onboarding as buyer (no role) | Buyer |

---

## UC-01 — Register holder identity

| Field | Content |
|-------|---------|
| **Goal** | Leave the `holder` verified in `IdentityRegistry` with country, investor type, and expiry. |
| **Preconditions** | MetaMask on the lab network (local 31337 or Sepolia); account with **verifier** role; IdentityRegistry deployed. |
| **Trigger** | Operator or business requests KYC onboarding before issuing or transferring. |
| **Main flow** | 1. Open `/verificador`. 2. Connect MetaMask (verifier account). 3. Fill holder (bytes32), country, type, date. 4. Review preview (country code + unix). 5. **Sign identity** (EIP-712). 6. Confirm tx `registerAssertion`. |
| **Alternatives** | A1 Incomplete fields → UC-16. A2 Account without role → UC-15 (`InvalidSignature`). A3 Wrong network → UC-14. |
| **Postconditions** | `isVerified(holder) == true` until `expiry` or `revoke`. |
| **Screenshot** | `doc/qa-screenshots/q-verificador.png` |

---

## UC-02 — Certify an asset

| Field | Content |
|-------|---------|
| **Goal** | Accumulate EIP-712 certifier signatures until the `AttestationRegistry` quorum (existence / registral status). |
| **Preconditions** | Known asset (`assetId`); issuer/operator accounts per signing policy; MetaMask on correct network. |
| **Trigger** | Before `issue` (I7: issuance requires valid certifications). |
| **Main flow** | 1. `/verificador`. 2. Choose `assetId` and certification type. 3. Sign with the certifier account. 4. Repeat with the second quorum key if applicable. 5. Check on `/activos/[assetId]` that the certification appears active. |
| **Alternatives** | A1 Incomplete quorum → `issue` blocked. A2 Expired certification → UC-08 in DvP. |
| **Postconditions** | Asset certified; ready for issuance. |

---

## UC-03 — Issue units

| Field | Content |
|-------|---------|
| **Goal** | Mint units on Ethereum (`TitleRegistry.issue`) and emit an `ISSUE` message toward Solana. |
| **Preconditions** | Verified holder (UC-01); certified asset (UC-02); **issuer** account; bridge wired. |
| **Trigger** | Initial batch issuance. |
| **Main flow** | 1. `/operador` + Connect MetaMask (issuer). 2. Fill `assetId`, amount, holder (bytes32). 3. **Issue** → confirmation panel (values **decoded from the tx**, not blindly from the form — W4). 4. Sign in MetaMask. 5. On testnet: relayers deliver; Solana `apply_issue` mints Token-2022. 6. Verify I2 on `/puente`. |
| **Alternatives** | A1 No issuer role → button disabled / revert. A2 No certification → on-chain revert. A3 Active pause → UC-10 blocks. |
| **Postconditions** | Holder Eth balance ↑; outbound `ISSUE` message; (testnet) mirrored Solana mint. |
| **Testnet evidence** | `issue` UI `0xa1b9…` · `doc/DEPLOY-TESTNET-ES.md` |
| **Screenshot** | `doc/front-screenshots/operador.png` · `doc/qa-screenshots/g1-happy.png` |

---

## UC-04 — View detail and ledger

| Field | Content |
|-------|---------|
| **Goal** | Inspect name, holders, certifications, and entry chain **recomputed in the browser**. |
| **Preconditions** | No wallet required. |
| **Trigger** | Public audit / due diligence. |
| **Main flow** | 1. `/activos`. 2. Open an `assetId`. 3. Read certifications and holders. 4. See ledger status (intact / broken at entry N). |
| **Alternatives** | A1 Invalid `assetId` → error screen. A2 Missing route → 404. |
| **Postconditions** | Read-only; no state change. |
| **Screenshot** | `doc/front-screenshots/activo-detalle.png` · `doc/qa-screenshots/q-publico.png` |

---

## UC-05 — Sell (publish + accept → DvP link)

| Field | Content |
|-------|---------|
| **Goal** | Publish a lot and, when accepting an offer, sign as seller and generate the co-sign link. |
| **Preconditions** | Phantom Devnet; C1 with title mint balance; distinct buyer (C2). |
| **Trigger** | Holder wants to sell N units at a price (Lab USD). |
| **Main flow (testnet UI)** | 1. `/cartera/vender` + Connect Phantom (C1). 2. **Publish lot** (quantity). 3. Wait for C2 offer (UC-06). 4. **Accept offer** → Phantom: approve + seller signature. 5. **Copy link** `/cartera/firmar#…` and send to C2 (~1 min validity). |
| **Protocol** | After C2 signs (UC-06): `request_transfer` on-chain escrow → relayers → Eth `TRANSFER_REQUEST`. |
| **Alternatives** | A1 Not connected / wrong network. A2 Self-buy blocked (C1=C2). A3 Expired link → Accept again. A4 Cancel offer → UC-07. |
| **Postconditions** | Link ready for C2; after UC-06, escrow with title+payment. |
| **Screenshot** | `doc/qa-screenshots/q-titular.png` |

---

## UC-06 — Buy (offer + sign escrow)

| Field | Content |
|-------|---------|
| **Goal** | Register interest and, with the seller’s link, sign `request_transfer` releasing Lab USD into escrow. |
| **Preconditions** | Published lot (UC-05); Phantom C2 ≠ C1; Lab USD ATA with balance; valid link. |
| **Main flow (testnet UI)** | 1. `/cartera/comprar` + Phantom C2. 2. **Buy** → Pending offer (no tx). 3. Open the link C1 sent → `/cartera/firmar`. 4. Connect C2 → **Sign and send escrow**. |
| **Protocol** | Buyer signature completes the atomic escrow (C1 title + C2 payment). Eth decides later; settle releases funds. |
| **Postconditions** | On-chain escrow; C1 title ↓ and C2 Lab USD ↓; final settlement pending Eth. |
| **Screenshot** | `doc/qa-screenshots/q-comprador.png` |

---

## UC-07 — Cancel pending offer / listing

| Field | Content |
|-------|---------|
| **Goal** | Abort a Pending offer **before** C2 closes the escrow. |
| **Preconditions** | Own Pending offer on `/cartera/vender`. |
| **UI flow** | **Cancel** on the offer → listing may return to Open in the session. |
| **Postconditions** | Offer no longer actionable; if escrow was already sent, UI cancel does not apply. |

---

## UC-08 — Rejection for identity / certification

| Field | Content |
|-------|---------|
| **Goal** | Eth decides `Rejected` with a readable reason (buyer without KYC, expired cert, frozen/paused asset…). |
| **Preconditions** | `TRANSFER_REQUEST` Pending; `decide()` re-evaluates I7 at decision time. |
| **Flow** | Operator/automatic calls `decide` → `TRANSFER_DECISION Rejected(reason)` → Solana refund per deadline rules. |
| **UI** | In wallet, lab examples show copy: «Rejected: buyer without valid identity» / «expired certification…». |
| **Postconditions** | Funds/tokens released per D4–D6; not Completed. |

---

## UC-09 — Expiry and refund

| Field | Content |
|-------|---------|
| **Goal** | After `deadline`, Eth can only `Expired`; after `hardDeadline` (+7d), Solana allows `refund_after_hard_deadline`. |
| **Preconditions** | Request with open escrow. |
| **Flow** | See [`flujograma-EN.md`](./flujograma-EN.md) § deadlines. UI shows deadline/hardDeadline hint. |
| **Postconditions** | Escrow emptied; late Approved after hardDeadline is rejected (D6 → UC-12). |

---

## UC-10 — Pause

| Field | Content |
|-------|---------|
| **Goal** | Guardian pauses sensitive operations (bridge / registry per role). |
| **Preconditions** | Account with **guardian** role. |
| **UI flow** | `/operador` → **Pause** (enabled only with role). |
| **Postconditions** | Issue / inbound may revert `Paused`; limits damage if quorum is compromised (D12). |
| **Screenshot** | `doc/qa-screenshots/q-operador.png` |

---

## UC-11 — Court order

| Field | Content |
|-------|---------|
| **Goal** | Execute `FORCED_TRANSFER` anchored to `resolutionHash` (permanent delegate on Solana). |
| **Preconditions** | **courtExecutor** role; non-empty resolution hash. |
| **Flow** | `/operador` → **Court order** → confirm tx → outbound message → `apply_forced_*` on Solana. |
| **Postconditions** | Movement via court path; entry with anchor. |

---

## UC-12 — Reconcile D6

| Field | Content |
|-------|---------|
| **Goal** | Fix Eth↔Sol divergence after late Approved / relayer failure (report + `resolutionHash`). |
| **Preconditions** | **operator** role; valid resolution hash; request in reconciliable state. |
| **Flow** | Detect bad I2/state on `/puente` → `/operador` → **Reconcile D6**. |
| **Alternatives** | Double reconcile / zero hash → revert (X20/X21). |
| **Postconditions** | Aligned state; no double mint. |

---

## UC-13 — Monitor the bridge

| Field | Content |
|-------|---------|
| **Goal** | See messages (seen/signed/delivered), relayers, and I2 semaphore. |
| **Preconditions** | None (read). Optional relayer status GET API. |
| **Flow** | Open `/puente`; interpret green/red I2; do not treat relayer data as truth (copy «as reported by the relayer»). |
| **Screenshot** | `doc/front-screenshots/puente.png` |

---

## UC-14 — Wrong network (W2)

| Field | Content |
|-------|---------|
| **Goal** | Prevent signing if the **connected** wallet is not on the expected network. |
| **Trigger** | MetaMask on Mainnet with app on Sepolia; or Phantom off Devnet. |
| **Flow** | Banner «Wrong network…»; sign buttons disabled; user switches network → recovers. |
| **UX note** | The banner **must not** alarm on `/cartera` if MetaMask is not connected. |
| **Screenshot** | `doc/qa-screenshots/q-novato.png` |

---

## UC-15 — Account without role / invalid signature

| Field | Content |
|-------|---------|
| **Goal** | Reject privileged actions with the wrong account. |
| **UI flow** | Buttons disabled (`roleDisabled`) or, if signing is forced, revert `InvalidSignature` / `Unauthorized`. |
| **Testnet evidence** | Non-verifier account → `InvalidSignature` (`0x8baa579f`). |
| **Lab** | «Remove roles (lab)» button simulates privilege loss in the demo. |

---

## UC-16 — Incomplete fields (verifier)

| Field | Content |
|-------|---------|
| **Goal** | Do not prepare EIP-712 with half-filled data. |
| **Flow** | Clear country or other fields → `#id-incomplete` warning + Sign button disabled + `aria-describedby`. |
| **Postconditions** | No tx sent. |

---

## UC-17 — Onboarding as buyer

| Field | Content |
|-------|---------|
| **Goal** | Let a new client enter the product as buyer **without** `BUYER_ROLE` or admin. |
| **Preconditions** | Phantom (Devnet on testnet); IdentityRegistry deployed to read `isVerified`. |
| **Trigger** | User chooses **Buyer** in the nav or from Home. |
| **Main flow** | 1. `/comprador`. 2. Connect Phantom. 3. See holder = Solana pubkey as `bytes32` (D2); copy or open Verifier with `?holder=`. 4. Refresh KYC status (`isVerified`). 5. Confirm onboarding (UI session). 6. Go to Assets / Wallet. |
| **Alternatives** | A1 No Phantom → no holder. A2 No KYC → can browse; I7 purchases will fail on-chain. A3 RPC down → «unknown» status. |
| **Postconditions** | Known holder; verification read from chain; **no** AccessControl role created. |
| **UI** | `/comprador` · contextual help `comprador` |

---

## QA persona ↔ cases traceability

| QA persona | Cases covered |
|------------|---------------|
| Q-Holder | UC-05, UC-07 |
| Q-Buyer | UC-06, UC-17 |
| Q-Operator | UC-03, UC-10, UC-11, UC-12, UC-15 |
| Q-Verifier | UC-01, UC-02, UC-16 |
| Q-Public | UC-04, UC-13 |
| Q-Novice | UC-14, UC-15 |

---

## Out of scope for UI v1 (protocol yes)

- Full settle (Eth decision → release escrow to C1/C2) with a single “close sale” button in Wallet.
- Court orders / reconcile with rich hash forms (lab minimum).
- Mobile app / eIDAS login.
- Durable nonce (today the sign link lasts ~1 min per blockhash).
