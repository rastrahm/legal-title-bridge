import { z } from 'zod';
import { NetworkIdSchema } from './index.ts';

const EthereumAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const SolanaAddressSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

export const AddressesSchema = z.record(
  NetworkIdSchema,
  z.object({
    ethereum: EthereumAddressSchema,
    solana: SolanaAddressSchema
  })
);

export const PLACEHOLDER_ETHEREUM_ADDRESS = '0x0000000000000000000000000000000000000000';
export const PLACEHOLDER_SOLANA_ADDRESS = '11111111111111111111111111111111';

export const addresses = AddressesSchema.parse({
  local: {
    ethereum: PLACEHOLDER_ETHEREUM_ADDRESS,
    solana: PLACEHOLDER_SOLANA_ADDRESS
  },
  'sepolia-devnet': {
    ethereum: PLACEHOLDER_ETHEREUM_ADDRESS,
    solana: PLACEHOLDER_SOLANA_ADDRESS
  }
});
