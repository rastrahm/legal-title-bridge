import { describe, expect, it } from "vitest";

import { dateInputToUnixExpiry, defaultExpiryDateInput } from "./dates";

describe("dates helpers", () => {
  it("converts YYYY-MM-DD to end-of-day UTC unix", () => {
    expect(dateInputToUnixExpiry("2030-01-15")).toBe(
      Math.floor(Date.UTC(2030, 0, 15, 23, 59, 59) / 1000),
    );
  });

  it("defaultExpiryDateInput is one year ahead YMD", () => {
    expect(defaultExpiryDateInput(new Date(Date.UTC(2026, 10, 21)))).toBe(
      "2027-11-21",
    );
  });
});
