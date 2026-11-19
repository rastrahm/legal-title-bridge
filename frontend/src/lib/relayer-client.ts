/**
 * Read-only relayer HTTP client. Responses are informational only (W6).
 * Chain truth for balances / ownership must come from chain readers.
 */

import { z } from "zod";

const StatusSchema = z.object({
  i2Ok: z.boolean(),
  ethCirculating: z.string(),
  solIssued: z.string(),
  messageCount: z.number().int().nonnegative(),
});

export type RelayerStatus = z.infer<typeof StatusSchema>;

export interface RelayerClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

/**
 * GET /status — never used as sole authority for ownership actions.
 */
export async function fetchRelayerStatus(
  opts: RelayerClientOptions,
): Promise<RelayerStatus> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(`${opts.baseUrl.replace(/\/$/, "")}/status`, {
    method: "GET",
  });
  if (!res.ok) {
    throw new Error(`relayer status HTTP ${res.status}`);
  }
  const json: unknown = await res.json();
  return StatusSchema.parse(json);
}
