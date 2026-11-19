import { describe, expect, it } from "vitest";

import { sanitizeHttpsUrl } from "./links";

describe("sanitizeHttpsUrl (W1)", () => {
  it("allows https and rejects javascript / http", () => {
    expect(sanitizeHttpsUrl("https://example.com/a")).toBe(
      "https://example.com/a",
    );
    expect(sanitizeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeHttpsUrl("http://example.com")).toBeNull();
  });
});
