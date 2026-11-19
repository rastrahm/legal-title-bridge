import { describe, expect, it } from "vitest";

import { t } from "./i18n";

describe("i18n", () => {
  it("returns ES and EN dictionaries", () => {
    expect(t("es").navBridge).toBe("Puente");
    expect(t("en").navBridge).toBe("Bridge");
  });
});
