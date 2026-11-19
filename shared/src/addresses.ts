import { z } from 'zod';
import { NetworkIdSchema } from './network.ts';

const EthereumAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const SolanaAddressSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

export const NetworkAddressesSchema = z.object({
  /** Primary Ethereum entry used by older callers (BridgeEndpoint). */
  ethereum: EthereumAddressSchema,
  /** Title-mirror program id on Solana. */
  solana: SolanaAddressSchema,
  titleRegistry: EthereumAddressSchema,
  identityRegistry: EthereumAddressSchema,
  attestationRegistry: EthereumAddressSchema,
  bridgeEndpoint: EthereumAddressSchema,
});

export const AddressesSchema = z.record(NetworkIdSchema, NetworkAddressesSchema);

export type NetworkAddresses = z.infer<typeof NetworkAddressesSchema>;

export const PLACEHOLDER_ETHEREUM_ADDRESS = '0x0000000000000000000000000000000000000000';
export const PLACEHOLDER_SOLANA_ADDRESS = '11111111111111111111111111111111';

const localPlaceholders: NetworkAddresses = {
  ethereum: PLACEHOLDER_ETHEREUM_ADDRESS,
  solana: PLACEHOLDER_SOLANA_ADDRESS,
  titleRegistry: PLACEHOLDER_ETHEREUM_ADDRESS,
  identityRegistry: PLACEHOLDER_ETHEREUM_ADDRESS,
  attestationRegistry: PLACEHOLDER_ETHEREUM_ADDRESS,
  bridgeEndpoint: PLACEHOLDER_ETHEREUM_ADDRESS,
};

export const addresses = AddressesSchema.parse({
  local: localPlaceholders,
  'sepolia-devnet': { ...localPlaceholders },
});
