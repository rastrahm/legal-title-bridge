# Help manual — Legal Title Bridge

> 🌐 **English** · [Español](./manual-de-ayuda-ES.md)

**Audience:** lab operators, verifiers, issuers, and UI testers.  
**Environment:** test networks (Sepolia + Solana Devnet) or local lab. **No real funds.**  
**Companion:** [`casos-de-uso-EN.md`](./casos-de-uso-EN.md) · screenshots in `doc/front-screenshots/` and `doc/qa-screenshots/`.

**In the app:** each screen has the collapsible **«Help for this screen»** panel with the same contextual content (ES/EN). This document expands the lab walkthrough.

---

## 1. Before you start

### 1.1 What this is

Legal Title Bridge tokenizes a title (e.g. a wine lot) on **Ethereum** and mirrors it on **Solana** (Token-2022). Ethereum decides; Solana mirrors. The web **builds** transactions and shows state; truth lives on-chain (D14).

### 1.2 What you need

| Piece | What for |
|-------|----------|
| Recent Chromium/Firefox | Next.js UI |
| **MetaMask** | Ethereum: verify, certify, issue, pause, etc. |
| **Phantom** (2 lab accounts) | Solana Devnet: seller (C1) and buyer (C2); Lab USD + Token-2022 title |
| Sepolia ETH / Devnet SOL | Testnet only; official faucets |
| Role accounts | verifier, issuer, operator, guardian, court — per action |

### 1.3 Correct networks

| Mode | Ethereum | Solana |
|------|----------|--------|
| Lab testnet | **Sepolia** (chainId `11155111`) | **Devnet** |
| Playwright UI / local demo | Anvil `31337` | lab genesis / stub |

If the **connected** wallet is on another network, you will see the red banner «Wrong network…» and cannot sign (W2).

### 1.4 Start the web (lab)

```bash
cd frontend
nvm use 22
# .env.local: NEXT_PUBLIC_NETWORK_ID=sepolia-devnet  (or local)
npm run dev
# → http://localhost:3000
```

Language: **ES / EN** switch top-right (do not mix critical chrome mid-flow).

---

## 2. Screen map

| Route | Name | Who |
|-------|------|-----|
| `/` | Home | Everyone — I2 summary and entry points |
| `/activos` | Explorer | Public |
| `/activos/[assetId]` | Asset detail | Public |
| `/comprador` | Buyer | New client (Phantom → holder → KYC) |
| `/cartera` | Wallet | Holder / buyer (Phantom) |
| `/operador` | Operator | Issuer, operator, guardian, court (MetaMask) |
| `/verificador` | Verifier | Verifier / certifiers (MetaMask) |
| `/puente` | Bridge | Public — messages and I2 semaphore |

Portfolio screenshots: `doc/front-screenshots/{home,activos,activo-detalle,cartera,operador,verificador,puente}.png`.

---

## 3. Verifier — identity and certification

**Cases:** UC-01, UC-02, UC-16 · Screenshot: `q-verificador.png`

### 3.1 Connect

1. Go to **Verifier**.
2. Click **Connect MetaMask**.
3. Choose the account with the **verifier** role (or certifier for that step).
4. Check that your address appears under the button (not `—`).
5. If the network banner appears: switch MetaMask to Sepolia (or local) and retry.

### 3.2 Sign identity (step by step)

1. **Holder (on-chain identifier):** paste the holder `bytes32` (64 hex after `0x`). Lab often uses demo holder `0xbbb…bbb`.
2. **Country:** pick from the dropdown (e.g. Spain → code `724` in the preview).
3. **Investor type:** Retail or Institutional.
4. **Expiry date:** use the date picker; the UI shows the resulting unix.
5. Review the **Preview** box (country → code, date → timestamp).
6. Click **Sign identity**.
7. In MetaMask: review the EIP-712 typed message (`LegalTitleBridge` / Assertion) and confirm.
8. Wait for the tx hash. On testnet: `registerAssertion` should appear on Sepolia Etherscan.

**If the button is gray:** a field is missing → «Complete all fields…» message bound to the control (`aria-describedby`). Fill and retry.

**If MetaMask reverts `InvalidSignature`:** that account is **not** an on-chain verifier. Switch accounts (do not use a random EOA).

### 3.3 Sign certification

1. Fill **Asset to certify** (`assetId` bytes32, e.g. `0xaaa…aaa`).
2. **Certification type:** Title existence / Registral status.
3. With the correct certifier account, **Sign certification**.
4. Repeat with the second quorum signature if the deployment requires it (on-screen hint: issuer signs both types; operator repeats).
5. Check in **Explorer → asset detail** that the certification is active.

---

## 4. Operator — issue and governance

**Cases:** UC-03, UC-10, UC-11, UC-12, UC-15 · Screenshots: `operador.png`, `q-operador.png`, `g1-happy.png`

### 4.1 Connect and roles

1. **Operator** → **Connect MetaMask**.
2. Use the **issuer** account to issue; **guardian** to pause; **court** for an order; **operator** to reconcile.
3. Buttons outside your role stay disabled with copy like «Your account does not have this role…».
4. (Lab only) **Remove roles (lab)** turns off all demo flags to test the lockout.

### 4.2 Issue (happy Eth cycle)

**Before:** UC-01 + UC-02 done for that holder/asset.

1. Fill:
   - **Asset id** (bytes32)
   - **Amount** (form; lab default `1000`)
   - **Recipient** (holder bytes32, not a raw Eth address)
2. Click **Issue**.
3. **Confirm transaction** opens:
   - Shown values are **decoded from the tx to sign**, not «blindly from the form».
   - If you change the form amount **after** building the tx, the panel still shows what will actually be signed (W4).
4. Review simulation OK if shown.
5. **Sign** in MetaMask.
6. Note the hash. On testnet there should be `OutboundEmitted` / `ISSUE` message.
7. Optional: open **Bridge** and check I2 (Eth vs Sol supply).

**Common errors**

| Symptom | What to do |
|---------|------------|
| Issue gray | Connect MetaMask, correct network, issuer role, and no pause / pending tx |
| Certification revert | Complete UC-02 |
| NotVerified revert | Complete UC-01 for that holder |
| Confusing double-click | Wait; Issue disables while `pendingTx` is set |

### 4.3 Pause

1. **guardian** account.
2. **Pause** → confirm.
3. Check that Issue / sensitive inbound fail until unpause (per deployed design).

### 4.4 Court order

1. **courtExecutor** account.
2. **Court order** → confirm the payload (includes resolution anchor / hash in the real flow).
3. Do not use an empty hash (revert).

### 4.5 Reconcile D6

1. On **Bridge**, if I2 is red or there is a divergence alert after relayer failure / late Approved:
2. **operator** account → **Reconcile D6**.
3. Use the documented procedure `resolutionHash`; do not resubmit the same hash twice.

---

## 5. Buyer — new client onboarding

**Case:** UC-17 · Route: `/comprador`

1. Open **Buyer** (nav or Home).
2. **Connect Phantom** (Devnet on testnet).
3. Copy the **holder** (`bytes32`) or click **Request verification** (opens Verifier with holder prefilled).
4. The verifier signs KYC (UC-01) for *that* holder.
5. **Refresh status** until you see «Verified…».
6. **Confirm onboarding** (only marks the UI session; creates no roles).
7. Continue to **Assets** or **Wallet**.

There is no `BUYER_ROLE` enrollment: the buyer is a wallet + optional identity.

---

## 6. Wallet — sell and buy (usable DvP)

**Cases:** UC-05–UC-09 · Routes: `/cartera` → `/cartera/vender` · `/cartera/comprar` · `/cartera/firmar`

Wallet is designed for **two people / two PCs** (or two Phantom accounts). You do not need to be in the same room switching accounts mid-signature.

### 6.0 What moves chain and what does not

| Action | On-chain? | Who |
|--------|-----------|-----|
| Publish lot | No (session catalog) | Seller (C1) |
| Buy (offer) | No (intent) | Buyer (C2) |
| Accept offer | Yes: approve + seller signature of `request_transfer` | C1 |
| Link → Sign DvP | Yes: C2 signs and **escrows** title + Lab USD | C2 |
| Final payout to C1 / title to C2 | Later: Eth decision + settle | Operator / relayer |

**Lab USD** (`NEXT_PUBLIC_PAYMENT_MINT`) ≠ title mint. C2 needs Lab USD balance; C1 needs Token-2022 title balance.

### 6.1 Prepare accounts

1. Phantom → **Devnet** (not Mainnet).
2. **C1 (seller):** pubkey with title mint units (e.g. after `apply_issue` / lab transfer).
3. **C2 (buyer):** different pubkey, with Lab USD in its Token-2022 ATA.
4. Use the **same browser tab** to publish/offer (the catalog lives in that tab’s `sessionStorage`). The **sign link** can be opened on another PC.

### 6.2 Connect

1. `/cartera` → **Sell** or **Buy**.
2. **Connect Phantom** → pubkey and «Connected» badge should show.
3. If «Wrong network» appears, Phantom is not on Devnet (or genesis mismatch).

### 6.3 C1 publishes the lot

1. Phantom = **C1** → `/cartera/vender`.
2. Enter quantity (≤ title balance) → **Publish**.
3. The lot appears under «My listings» and in the Buy catalog (same tab).

### 6.4 C2 makes the offer

1. Phantom = **C2** → `/cartera/comprar` (avoid F5 if you can; or republish if the catalog was cleared).
2. **Buy** on the lot → notice: offer sent. **Lab USD has not moved yet.**
3. C1 sees the offer under **Sell → Offers received**.

### 6.5 C1 accepts and generates the link (seller signature)

1. Phantom = **C1** → **Accept offer**.
2. Phantom will ask to sign (title approve; sometimes warns “withdraw in the future” — on lab Devnet that is the escrow allowance). Confirm only on Devnet with test accounts.
3. Then seller signature over `request_transfer`.
4. The **Copy buyer link** panel appears → `/cartera/firmar#…`.
5. **Send that link to C2** (chat, mail, etc.). Validity ~**1 minute** (Solana blockhash). If expired, C1 **Accept**s again and generates another.

### 6.6 C2 signs and releases payment into escrow

1. C2 opens the link on **their** PC (or the same) with Phantom = **C2**.
2. **Connect Phantom** if needed (must be exactly the buyer pubkey from the link).
3. **Sign and send escrow**.
4. Then: C2 Lab USD + C1 title go to on-chain **escrow**. C1 has **not** been paid yet; C2 has **not** received free title — Eth decision / settle still pending.

### 6.7 Cancel

On Pending offers (before escrow is closed), C1 can **Cancel** and reopen the listing in the UI.

### 6.8 Deadlines (concept)

- **deadline:** until then Ethereum can approve/reject.
- **hardDeadline = deadline + 7 days:** afterward, Solana may refund unilaterally; a late Approved triggers D6 reconciliation.

---

## 7. Explorer and bridge

### 7.1 Explorer

**Case:** UC-04 · Screenshots: `activos.png`, `activo-detalle.png`

1. **Explorer** lists demo assets / available data.
2. Open an `assetId`.
3. Review:
   - Name / description
   - Certifications (active / expired)
   - Holders
   - **Ledger:** «Entry chain intact» or «broken at entry N» (recomputed in the browser).
4. If you paste an invalid id in the URL → invalid asset message.
5. Invented route → **not found**.

### 7.2 Bridge

**Case:** UC-13 · Screenshot: `puente.png`

1. Open **Bridge**.
2. I2 semaphore: supplies match (green) or diverge (red).
3. Message list and states (seen / signed / delivered…).
4. Relayer status: if unavailable, **retry later**; the chain remains the source of truth — not a blank screen.

---

## 8. Error situations and recovery

### 8.1 Wrong network (UC-14)

1. MetaMask on Mainnet (or other) with app on Sepolia → banner + sign buttons off.
2. Switch to Sepolia → banner goes away → reconnect if needed.
3. Phantom: ensure **Devnet** before connecting in Wallet.

### 8.2 Wrong account (UC-15)

1. Gray buttons = no role in the demo / UI guard.
2. If you still sign with a key without on-chain permission → revert (`InvalidSignature`, `Unauthorized`, etc.).
3. Fix: import/select the account from `secrets/roles/` for the lab (never on mainnet).

### 8.3 Relayer down

1. Bridge shows actionable copy.
2. Do not invent deliveries; wait or restart the local status runner (`relayer/scripts/run-relayer-status.mjs`) if you are in lab.

### 8.4 Account change mid-issue

1. If you change the MetaMask account with a draft open, the UI **invalidates the draft** and warns.
2. Click Issue again with the correct account.

### 8.5 Page reload (catalog)

Wallet listings and offers are stored in the tab’s **`sessionStorage`**. An F5 in the same tab keeps them; another tab / profile starts empty (you must publish again). **On-chain** state (escrow, Token-2022 balances) does not depend on F5.

---

## 9. Recommended walkthrough (human smoke)

Suggested order for a 15–20 min smoke on testnet:

1. MetaMask Sepolia + verifier account → UC-01 (`/verificador`).
2. Certify asset → UC-02.
3. Issuer account → UC-03 issue; save hash.
4. `/puente` → check I2 / messages.
5. Phantom Devnet → `/cartera`: C1 publishes → C2 offers → C1 accepts + link → C2 `/cartera/firmar` (UC-05/06).
6. Intentionally try Mainnet briefly → UC-14; return to Sepolia.
7. Account without role → sign attempt → UC-15.

Evidence already run: [`DEPLOY-TESTNET-ES.md`](./DEPLOY-TESTNET-ES.md).

---

## 10. Quick glossary

| Term | Meaning |
|------|---------|
| Holder | On-chain identity `bytes32` (not always = visible Eth address) |
| ISSUE | Eth→Sol message: mint mirror |
| DvP | Delivery versus payment (Solana escrow + Eth decision) |
| I2 | Invariant: Eth supply ≈ Sol |
| I7 | Compliance: verified + certified + rules |
| W2 | Wallet network guard |
| W4 | Confirmation from decoded calldata |
| D6 | Reconciliation after late Approved / divergence |
| EIP-712 | Off-chain typed signature that the contract recovers on-chain |

---

## 11. Where to get more technical detail

| Topic | Doc |
|-------|-----|
| Formal cases | [`casos-de-uso-EN.md`](./casos-de-uso-EN.md) |
| Sequences and deadlines | [`flujograma-EN.md`](./flujograma-EN.md) |
| If/else decisions | [`diagrama-de-flujo-EN.md`](./diagrama-de-flujo-EN.md) |
| Codec / MsgType | [`PROTOCOLO-ES.md`](./PROTOCOLO-ES.md) |
| Testnet addresses | [`DEPLOY-TESTNET-ES.md`](./DEPLOY-TESTNET-ES.md) |
| UX findings | [`QA-ES.md`](./QA-ES.md) |
