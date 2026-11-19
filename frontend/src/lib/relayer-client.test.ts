import { describe, expect, it, vi } from "vitest";

import { fetchRelayerStatus } from "./relayer-client";

describe("fetchRelayerStatus", () => {
  it("parses GET /status JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        i2Ok: true,
        ethCirculating: "10",
        solIssued: "10",
        messageCount: 2,
      }),
    });
    const status = await fetchRelayerStatus({
      baseUrl: "http://127.0.0.1:8787",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(status.messageCount).toBe(2);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/status",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
