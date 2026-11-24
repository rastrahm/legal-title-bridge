/**
 * Re-export shared package symbols for the Next.js app.
 * Keeps D14: addresses still originate in `shared/src/addresses.ts`.
 */

export {
  addresses,
  PLACEHOLDER_ETHEREUM_ADDRESS,
  PLACEHOLDER_SOLANA_ADDRESS,
  type NetworkAddresses,
  type NetworkId,
} from "@legal-title-bridge/shared";
