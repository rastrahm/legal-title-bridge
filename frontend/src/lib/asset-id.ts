/**
 * Asset id validation for explorer routes.
 */

import { z } from "zod";

/** bytes32 hex asset id. */
export const AssetIdSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "assetId must be bytes32 hex");

export type AssetId = z.infer<typeof AssetIdSchema>;

export function parseAssetId(raw: string): AssetId | null {
  const r = AssetIdSchema.safeParse(raw);
  return r.success ? r.data : null;
}
