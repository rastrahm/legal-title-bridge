/**
 * Contextual help copy per screen (ES / EN). Shown in-app next to each view.
 */

import type { Locale } from "@/lib/i18n";

export type HelpScreenId =
  | "home"
  | "activos"
  | "activoDetalle"
  | "cartera"
  | "comprador"
  | "operador"
  | "verificador"
  | "puente";

export interface HelpItem {
  /** Control or section name */
  title: string;
  /** What it does / how to use it */
  body: string;
}

export interface ScreenHelp {
  /** Short intro for this page */
  summary: string;
  items: HelpItem[];
}

const es: Record<HelpScreenId, ScreenHelp> = {
  home: {
    summary:
      "Punto de entrada. Resumen de red e integridad del puente. No firma transacciones.",
    items: [
      {
        title: "Red",
        body: "Red configurada en la app (Sepolia+Devnet o local). No se elige por URL (D14).",
      },
      {
        title: "I2",
        body: "Compara suministro circulante en Ethereum vs emitido en Solana. Verde = cuadran; rojo = divergencia.",
      },
      {
        title: "Vistas",
        body: "Atajos a Explorador, Cartera y Puente. Operador y Verificador están en la barra superior.",
      },
      {
        title: "ES / EN",
        body: "Cambia el idioma de la interfaz. El estado de la sesión se mantiene.",
      },
    ],
  },
  activos: {
    summary:
      "Listado público de activos (lotes). Solo lectura; no necesitás billetera.",
    items: [
      {
        title: "Lista de activos",
        body: "Cada fila es un lote. El nombre es legible; debajo va el assetId (bytes32) usado on-chain.",
      },
      {
        title: "Abrir ficha",
        body: "Pulsá una fila para ver certificaciones, titulares y la cadena de asientos.",
      },
    ],
  },
  activoDetalle: {
    summary:
      "Ficha de un activo. Recalcula la cadena de hashes del ledger en tu navegador.",
    items: [
      {
        title: "Nombre y descripción",
        body: "Metadatos de demostración del lote. Enlaces externos solo si pasan filtro https.",
      },
      {
        title: "Certificaciones",
        body: "Tipos vigentes o vencidos (existencia, registral…). Emisión exige certificaciones activas (I7).",
      },
      {
        title: "Titulares",
        body: "Saldos por holder (identificador on-chain), no necesariamente tu address de MetaMask.",
      },
      {
        title: "Ledger / asientos",
        body: "Cada asiento tiene un hash encadenado. Si uno no cuadra, la UI marca en qué índice se rompe.",
      },
    ],
  },
  comprador: {
    summary:
      "Alta de comprador sin rol AccessControl: Phantom → holder bytes32 (D2) → KYC del verificador → Cartera/Explorador.",
    items: [
      {
        title: "Conectar Phantom",
        body: "Tu entrada al sistema. No hay usuario/contraseña ni BUYER_ROLE.",
      },
      {
        title: "Holder",
        body: "Pubkey Solana como bytes32 para IdentityRegistry. Copialo o mandalo al verificador.",
      },
      {
        title: "Estado de verificación",
        body: "Lectura on-chain de isVerified (RPC). Sin KYC vigente, las compras que exigen I7 fallarán.",
      },
      {
        title: "Confirmar ingreso",
        body: "Marca la sesión UI como comprador listo; no escribe roles en el contrato.",
      },
      {
        title: "Cartera / Activos",
        body: "Después podés explorar lotes y usar Comprar (demo) en Cartera.",
      },
    ],
  },
  cartera: {
    summary:
      "Vender publica y acepta; Comprar oferta; el link /cartera/firmar es donde C2 libera Lab USD al escrow (otro PC OK).",
    items: [
      {
        title: "Vender / Comprar",
        body: "Rutas /cartera/vender y /cartera/comprar. Phantom conectada = tu rol (C1 o C2).",
      },
      {
        title: "Publicar (C1)",
        body: "Listado de sesión (sessionStorage). C1 necesita saldo del mint título on-chain.",
      },
      {
        title: "Comprar (C2)",
        body: "Solo deja oferta pendiente. Todavía no se mueve Lab USD.",
      },
      {
        title: "Aceptar oferta (C1)",
        body: "Phantom: approve + firma vendedor. Luego copiá el link para el comprador (~1 min).",
      },
      {
        title: "Firmar (/cartera/firmar)",
        body: "C2 abre el link en su PC, conecta Phantom compradora y firma: ahí va el pago al escrow.",
      },
      {
        title: "Lab USD",
        body: "Token de pago (NEXT_PUBLIC_PAYMENT_MINT). Distinto del mint del título.",
      },
    ],
  },
  operador: {
    summary:
      "Consola privilegiada con MetaMask. Cada botón exige el rol on-chain (o flag lab) correspondiente.",
    items: [
      {
        title: "Conectar MetaMask",
        body: "Usá la cuenta issuer / operator / guardian / court según la acción. Red = la configurada.",
      },
      {
        title: "Asset id / Monto / Destinatario",
        body: "Formulario para armar la emisión. Destinatario es holder bytes32, no address Eth suelta.",
      },
      {
        title: "Emitir",
        body: "Prepara issue on-chain (issuer). Abre el panel de confirmación con calldata decodificado (W4).",
      },
      {
        title: "Confirmar transacción",
        body: "Muestra lo que vas a firmar (no el form a ciegas). Simulación OK/fallo antes de MetaMask.",
      },
      {
        title: "Pausar",
        body: "Acción de guardián para frenar operaciones sensibles si hay incidente.",
      },
      {
        title: "Orden judicial",
        body: "Camino FORCED_TRANSFER con ancla de resolución (rol courtExecutor).",
      },
      {
        title: "Reconciliar D6",
        body: "Corrige divergencia Eth↔Sol tras Approved tardío u otros desalineamientos (rol operator).",
      },
      {
        title: "Quitar roles (lab)",
        body: "Solo laboratorio: apaga flags de rol en la UI para probar botones deshabilitados.",
      },
    ],
  },
  verificador: {
    summary:
      "Firma EIP-712 de identidad (KYC) y certificaciones. MetaMask con cuenta verifier / certificador.",
    items: [
      {
        title: "Conectar MetaMask",
        body: "Cuenta con rol verifier para identidad; issuer/operator según quórum de certificación.",
      },
      {
        title: "Titular",
        body: "Identificador on-chain bytes32 del holder que queda verificado.",
      },
      {
        title: "País / Tipo / Fecha",
        body: "Campos humanos. La vista previa muestra código ISO numérico y unix de vencimiento.",
      },
      {
        title: "Firmar identidad",
        body: "signTypedData Assertion + registerAssertion on-chain. Campos incompletos bloquean el botón.",
      },
      {
        title: "Activo / Tipo de certificación",
        body: "assetId y kind (existencia o registral) para el AttestationRegistry.",
      },
      {
        title: "Firmar certificación",
        body: "Aporta una firma al quórum del activo. Suele hacer falta más de una cuenta.",
      },
    ],
  },
  puente: {
    summary:
      "Monitor del puente. Separá siempre verdad de cadena vs datos informados por el relayer.",
    items: [
      {
        title: "Leído de la cadena",
        body: "Suministros Eth/Sol e I2 según el estado que la app trata como lectura de cadena (lab: demo store).",
      },
      {
        title: "Informado por el relayer",
        body: "Status HTTP GET del relayer. Útil, pero no es verdad on-chain (D14).",
      },
      {
        title: "Mensajes",
        body: "Estados del ciclo (visto, firmado, entregado…). Sirve para seguir ISSUE / DvP en vuelo.",
      },
      {
        title: "Relayer no disponible",
        body: "Si falla el status, reintentá luego. La cadena sigue siendo la fuente de verdad.",
      },
    ],
  },
};

const en: Record<HelpScreenId, ScreenHelp> = {
  home: {
    summary:
      "Entry point. Network and bridge integrity snapshot. Does not sign transactions.",
    items: [
      {
        title: "Network",
        body: "App-configured network (Sepolia+Devnet or local). Never chosen from the URL (D14).",
      },
      {
        title: "I2",
        body: "Compares Ethereum circulating supply vs Solana issued. Green = match; red = divergence.",
      },
      {
        title: "Views",
        body: "Shortcuts to Explorer, Wallet, and Bridge. Operator and Verifier are in the top nav.",
      },
      {
        title: "ES / EN",
        body: "Switches UI language without dropping session state.",
      },
    ],
  },
  activos: {
    summary: "Public asset list (lots). Read-only; no wallet required.",
    items: [
      {
        title: "Asset list",
        body: "Each row is a lot. Human name on top; on-chain assetId (bytes32) underneath.",
      },
      {
        title: "Open detail",
        body: "Click a row for certifications, holders, and the ledger hash chain.",
      },
    ],
  },
  activoDetalle: {
    summary:
      "Single-asset sheet. Recomputes the ledger hash chain in your browser.",
    items: [
      {
        title: "Name and description",
        body: "Demo lot metadata. External links only if they pass the https filter.",
      },
      {
        title: "Certifications",
        body: "Active or expired kinds (existence, registral…). Issuance needs active certs (I7).",
      },
      {
        title: "Holders",
        body: "Balances by on-chain holder id — not necessarily your MetaMask address.",
      },
      {
        title: "Ledger entries",
        body: "Each entry has a chained hash. If one mismatches, the UI shows which index broke.",
      },
    ],
  },
  comprador: {
    summary:
      "Buyer onboarding without AccessControl role: Phantom → holder bytes32 (D2) → verifier KYC → Wallet/Explorer.",
    items: [
      {
        title: "Connect Phantom",
        body: "Your entry to the system. No username/password and no BUYER_ROLE.",
      },
      {
        title: "Holder",
        body: "Solana pubkey as bytes32 for IdentityRegistry. Copy it or send it to the verifier.",
      },
      {
        title: "Verification status",
        body: "On-chain isVerified read (RPC). Without active KYC, I7-gated purchases will fail.",
      },
      {
        title: "Confirm entry",
        body: "Marks this UI session as buyer-ready; does not grant contract roles.",
      },
      {
        title: "Wallet / Assets",
        body: "Then browse lots and use Buy (demo) on the Wallet page.",
      },
    ],
  },
  cartera: {
    summary:
      "Sell publishes and accepts; Buy places an offer; /cartera/firmar is where C2 escrows Lab USD (other PC OK).",
    items: [
      {
        title: "Sell / Buy",
        body: "Routes /cartera/vender and /cartera/comprar. Connected Phantom is your role (C1 or C2).",
      },
      {
        title: "Publish (C1)",
        body: "Session listing (sessionStorage). C1 needs on-chain title mint balance.",
      },
      {
        title: "Buy (C2)",
        body: "Only creates a pending offer. Lab USD does not move yet.",
      },
      {
        title: "Accept offer (C1)",
        body: "Phantom: approve + seller signature. Then copy the buyer link (~1 min).",
      },
      {
        title: "Sign (/cartera/firmar)",
        body: "C2 opens the link on their PC, connects buyer Phantom, and signs into escrow.",
      },
      {
        title: "Lab USD",
        body: "Payment token (NEXT_PUBLIC_PAYMENT_MINT). Not the title mint.",
      },
    ],
  },
  operador: {
    summary:
      "Privileged console via MetaMask. Each button needs the matching on-chain (or lab) role.",
    items: [
      {
        title: "Connect MetaMask",
        body: "Use issuer / operator / guardian / court accounts as needed. Network must match config.",
      },
      {
        title: "Asset id / Amount / Recipient",
        body: "Issue form fields. Recipient is a holder bytes32, not a bare Eth address.",
      },
      {
        title: "Issue",
        body: "Prepares on-chain issue (issuer). Opens confirmation with decoded calldata (W4).",
      },
      {
        title: "Confirm transaction",
        body: "Shows what you will sign (not the form blindly). Simulation OK/fail before MetaMask.",
      },
      {
        title: "Pause",
        body: "Guardian action to halt sensitive ops during an incident.",
      },
      {
        title: "Court order",
        body: "FORCED_TRANSFER path anchored to a resolution hash (courtExecutor role).",
      },
      {
        title: "Reconcile D6",
        body: "Fixes Eth↔Sol divergence after late Approved or similar (operator role).",
      },
      {
        title: "Strip roles (lab)",
        body: "Lab only: clears UI role flags to exercise disabled buttons.",
      },
    ],
  },
  verificador: {
    summary:
      "EIP-712 identity (KYC) and attestation signing. MetaMask with verifier / attestor accounts.",
    items: [
      {
        title: "Connect MetaMask",
        body: "Verifier role for identity; issuer/operator per attestation quorum policy.",
      },
      {
        title: "Holder",
        body: "On-chain bytes32 id that becomes verified.",
      },
      {
        title: "Country / Type / Date",
        body: "Human fields. Preview shows numeric ISO country code and unix expiry.",
      },
      {
        title: "Sign identity",
        body: "signTypedData Assertion + registerAssertion. Incomplete fields disable the button.",
      },
      {
        title: "Asset / Certification type",
        body: "assetId and kind (existence or registral) for AttestationRegistry.",
      },
      {
        title: "Sign attestation",
        body: "Adds one quorum signature for the asset. Often needs more than one account.",
      },
    ],
  },
  puente: {
    summary:
      "Bridge monitor. Always separate chain truth from relayer-informed data.",
    items: [
      {
        title: "Read from chain",
        body: "Eth/Sol supplies and I2 from what the app treats as chain read (lab: demo store).",
      },
      {
        title: "Informed by the relayer",
        body: "Relayer GET status. Helpful, but not on-chain truth (D14).",
      },
      {
        title: "Messages",
        body: "Lifecycle statuses (seen, signed, delivered…). Track ISSUE / DvP in flight.",
      },
      {
        title: "Relayer unavailable",
        body: "If status fails, retry later. The chain remains the source of truth.",
      },
    ],
  },
};

const byLocale: Record<Locale, Record<HelpScreenId, ScreenHelp>> = { es, en };

/** Returns localized help for a screen. */
export function getScreenHelp(
  screen: HelpScreenId,
  locale: Locale,
): ScreenHelp {
  return byLocale[locale][screen];
}
