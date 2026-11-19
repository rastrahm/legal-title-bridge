import { z } from 'zod';

export const NetworkIdSchema = z.enum(['local', 'sepolia-devnet']);
export type NetworkId = z.infer<typeof NetworkIdSchema>;
