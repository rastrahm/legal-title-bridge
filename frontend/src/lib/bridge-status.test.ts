import { describe, expect, it } from "vitest";

import { checkI2 } from "./bridge-status";

describe("checkI2", () => {
  it("compares supplies", () => {
    expect(checkI2({ ethCirculating: 10n, solIssued: 10n })).toBe(true);
    expect(checkI2({ ethCirculating: 10n, solIssued: 9n })).toBe(false);
  });
});
