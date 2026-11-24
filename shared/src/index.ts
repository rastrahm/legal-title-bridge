/**
 * Single source for network ids, packet codec, and deployment addresses (D14).
 * Consumers (frontend, relayer) must import from `@legal-title-bridge/shared` — do not copy.
 */
export const PING = 'boot-ok';

export * from './network.ts';
export * from './codec.ts';
export * from './addresses.ts';
