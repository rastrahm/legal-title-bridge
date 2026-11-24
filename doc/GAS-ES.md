# Optimización de gas — Legal Title Bridge (Ethereum ↔ Solana)

> 🌐 **Español** · [English](./GAS-EN.md)

Regenerar:

```bash
export PATH="$HOME/.foundry/bin:$PATH"
forge test --match-contract HotPathGasTest --gas-report
forge snapshot --match-contract HotPathGasTest
```

Para refrescar el snapshot completo de la suite (hot paths + rutas EXTATK / unit ya rastreadas):

```bash
export PATH="$HOME/.foundry/bin:$PATH"
forge snapshot
# o comprobar regresiones: forge snapshot --check
```

**Fecha baseline:** 2026-11-23 (SOLV / sync docs)  
**Snapshot:** `.gas-snapshot` (`test/gas/HotPath.gas.t.sol` + rutas EXTATK de puente)  
**Optimizer:** `optimizer_runs = 10_000`, `via_ir = true`, solc `0.8.37`, EVM Cancun (`foundry.toml`)  
**Nota:** `forge snapshot --match-contract HotPathGasTest` solo reescribe `.gas-snapshot` con esos tests; hay que fusionar o re-correr un snapshot más amplio si deben conservarse las filas EXTATK.

---

## Matriz de hot paths (snapshot)

| Path | Test | Gas (snapshot) | Notas |
|------|------|----------------|-------|
| `issue` | `testGas_issue` | **160 929** | Emisión + `ISSUE` outbound (−78 vs pre-REF-2: `_emitOutboundIfWired`) |
| `submitInbound` | `testGas_submitInbound` | **246 836** | Quórum + marca `MessageIdSet` + dispatch `TRANSFER_REQUEST` |
| `decide` | `testGas_decide` | **161 003** | Aprobación + asiento + `TRANSFER_DECISION` (−61 vs pre-REF-2) |
| `rotate` | `testGas_rotate` | **56 433** | `executeRotateRelayers` tras timelock (propose/warp en `setUp`) |
| flow limit | `testGas_flowLimitConsume` | **41 080** | `ISSUE` outbound consumiendo el limitador de ventana 24 h |

### Rutas EXTATK / borde relacionadas (mismo `.gas-snapshot`)

| Path | Gas | Notas |
|------|-----|-------|
| `test_X7_flowWindowFragmentation_revertFlowLimit` | **1 101 978** | ISSUE troceado hasta tope de ventana (path de revert) |
| `test_X4_oldEpochAfterRotation_revertWrongDomain` | **177 216** | Época vieja tras rotación |
| `test_X3_replayWithDifferentMsgType_revertAlreadyProcessed` | **298 643** | Replay / I3 |

> La preparación de los hot paths vive en `setUp` para que el gas por test de Foundry refleje la llamada medida. Los números cambian con compilador/OZ; regenerar tras cambios materiales en `src/`.

---

## Técnicas aplicadas / tradeoffs

| Técnica | Dónde | Efecto / tradeoff |
|---------|-------|-------------------|
| **CEI** | `decide`, `submitInbound`, mutaciones del registro | Estado / id de mensaje marcados antes del outbound externo; fails baratos se quedan baratos; Aderyn H-1 es falso positivo (ver SWC-AUDIT) |
| **Custom errors** | `BridgeErrors`, `RegistryErrors`, códec | Reverts más baratos que `require` con string; asserts EXTATK/REDTEAM más claros |
| **OZ v5 `AccessControl`** | Title / Identity / Attestation / Bridge | Coste SLOAD de roles vs un solo owner; necesario para separación D13 |
| **`FlowLimiter` ventana 24 h** | Montos inbound/outbound de `BridgeEndpoint` | Acota pérdida estilo Ronin (D12); el happy path paga la contabilidad de ventana; fragmentación paga hasta `FlowLimitExceeded` |
| **`optimizer_runs = 10_000` + `via_ir`** | `foundry.toml` | Favorece inlining de hot paths; IR compila más lento pero es aceptable en este módulo |
| **`ReentrancyGuardTransient` / CEI** | DvP / decide | Lock transitorio Cancun donde aplica; sin SSTORE de guard clásico en el happy path |

---

## Referencias

- [`foundry.toml`](../foundry.toml)
- [`test/gas/HotPath.gas.t.sol`](../test/gas/HotPath.gas.t.sol)
- [`.gas-snapshot`](../.gas-snapshot)
- [SWC-AUDIT-ES.md](./SWC-AUDIT-ES.md)
- [INVARIANTES-ES.md](./INVARIANTES-ES.md)
