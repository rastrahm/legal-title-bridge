/**
 * Minimal ES/EN copy dictionaries for Legal Title Bridge UI.
 */

export type Locale = "es" | "en";

export const dictionaries = {
  es: {
    brand: "Legal Title Bridge",
    navHome: "Inicio",
    navExplorer: "Explorador",
    navWallet: "Cartera",
    navOperator: "Operador",
    navVerifier: "Verificador",
    navBridge: "Puente",
    networkMismatch:
      "Red incorrecta: conecta la billetera a la red configurada antes de firmar.",
    relayerInformed: "Informado por el relayer (no es verdad on-chain)",
    chainTruth: "Leído de la cadena",
    i2Ok: "Suministros cuadran (I2)",
    i2Bad: "Divergencia de suministro (I2)",
    confirmTitle: "Confirmar transacción",
    confirmHint:
      "Lo mostrado se decodifica de la transacción a firmar, no del formulario.",
    ledgerOk: "Cadena de asientos íntegra",
    ledgerBroken: "Cadena rota en el asiento",
    wrongNetworkCta: "Cambiar de red",
    connectEth: "Conectar MetaMask",
    connectSol: "Conectar Phantom",
    roleDisabled: "Tu cuenta no tiene este rol en el contrato",
    notFound: "Ruta no encontrada",
    homeLead:
      "Puente Ethereum–Solana para títulos legales tokenizados. Ethereum manda; Solana refleja.",
  },
  en: {
    brand: "Legal Title Bridge",
    navHome: "Home",
    navExplorer: "Explorer",
    navWallet: "Wallet",
    navOperator: "Operator",
    navVerifier: "Verifier",
    navBridge: "Bridge",
    networkMismatch:
      "Wrong network: connect your wallet to the configured network before signing.",
    relayerInformed: "Informed by the relayer (not on-chain truth)",
    chainTruth: "Read from chain",
    i2Ok: "Supplies match (I2)",
    i2Bad: "Supply divergence (I2)",
    confirmTitle: "Confirm transaction",
    confirmHint:
      "Shown values are decoded from the transaction to sign, not from the form.",
    ledgerOk: "Ledger chain intact",
    ledgerBroken: "Ledger broken at entry",
    wrongNetworkCta: "Switch network",
    connectEth: "Connect MetaMask",
    connectSol: "Connect Phantom",
    roleDisabled: "Your account lacks this on-chain role",
    notFound: "Page not found",
    homeLead:
      "Ethereum–Solana bridge for tokenized legal titles. Ethereum is authoritative; Solana mirrors.",
  },
} as const;

export type Dictionary = (typeof dictionaries)[Locale];

export function t(locale: Locale): Dictionary {
  return dictionaries[locale];
}
