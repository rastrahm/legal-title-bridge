# QA — simulated human agent

> 🌐 **English** · [Español](./QA-ES.md)

**Phase:** QA · **Branch:** `qa` · **Date:** 2026-11-20  
**Stack:** Next.js lab (`frontend/`, demo store) + Playwright Chromium  
**Suite:** `frontend/e2e/qa-personas.spec.ts` · screenshots in `doc/qa-screenshots/`

## Verdict

| Criterion | Status |
|-----------|--------|
| 6 personas covered | ✅ |
| Scripts 1–10 executed | ✅ |
| Open `blocker` findings | **0** |
| Open `major` findings | **0** (fixed in this phase) |
| Report reviewed | ✅ |

**Command:** `cd frontend && npx playwright test e2e/qa-personas.spec.ts` (also in `make check-qa`).

---

## Personas

| Persona | Result | Notes |
|---------|--------|-------|
| Q-Holder | ✅ | Connects Phantom (lab), sells, cancels, retries price 9 |
| Q-Buyer | ✅ | UC-17 `/comprador` (Phantom→holder→entry) + demo buy/deposit; `?holder=` preloads Verifier |
| Q-Operator | ✅ | Issue → confirm; pause; reconcile; order; role strip disables buttons |
| Q-Verifier | ✅ | Incomplete fields block signing; field-linked warning |
| Q-Public | ✅ | Explorer, bridge, invalid `assetId`, 404 |
| Q-Novice | ✅ | `e2eChain=1` blocks (W2); back to local + connect, Issue enables |

---

## Scripts 1–10

| # | Script | Result |
|---|--------|--------|
| 1 | Happy UI path (issue + confirm; I2 on `/puente`) | ✅ |
| 2 | Abandon mid-flow + cancel sale | ✅ |
| 3 | Clear certification rejection reason | ✅ |
| 4 | Double submit: single confirmation panel | ✅ |
| 5 | Reload: lab state resets (in-memory demo) | ✅ (accepted, see minor) |
| 6 | Account change invalidates draft | ✅ |
| 7 | In-flight messages + deadline/hardDeadline hint | ✅ |
| 8 | Missing relayer: actionable copy, no blank screen | ✅ |
| 9 | ES↔EN i18n without mixing critical chrome | ✅ |
| 10 | Keyboard + `aria-describedby` on verifier | ✅ |

---

## Findings

### Major (fixed)

| ID | Finding | Fix |
|----|---------|-----|
| QA-M1 | Hardcoded ES chains (breaks i18n script) | Keys in `lib/i18n.ts`; views use `dict` |
| QA-M2 | Sell/Buy had no effect | Demo actions + notices on `/cartera` |
| QA-M3 | Issue without connected wallet | `canSignEth` requires `ethAddress` |
| QA-M4 | Double-click opened confusing paths | `busy` / `pendingTx` disable Issue |
| QA-M5 | Account change did not clear draft | `useEffect` clears `pendingTx` + notice |
| QA-M6 | CSP `script-src` without `'unsafe-inline'` broke hydration in **dev** | `next.config.ts`: unsafe-inline only outside production |

### Minor / improvement (open, do not block EXTATK)

| ID | Class | Finding | Owner |
|----|-------|---------|-------|
| QA-m1 | minor | Reload loses demo store (not chain reads) | Lab v1; TESTNET will use real RPCs |
| QA-m2 | minor | Wallet countdown uses fixed demo `now` | UX; polarize to real clock on TESTNET |
| QA-m3 | improvement | Home does not show Eth/Sol amounts, only I2 | Nice-to-have |
| QA-m4 | minor | “Remove roles (lab)” button visible on operator | Lab only; hide after E2E if annoying |

### Blocker

None.

---

## Screenshots

`doc/qa-screenshots/`: `q-titular`, `q-comprador-onboarding`, `q-comprador`, `q-operador`, `q-verificador`, `q-publico`, `q-novato`, `g1-happy`.

## Regression

`e2e/attacks-w.spec.ts` + `e2e/flows.spec.ts` green after the fixes (26 Playwright tests in the combined run).
