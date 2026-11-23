import { describe, expect, it } from "vitest";

import { getScreenHelp, type HelpScreenId } from "./content";

const SCREENS: HelpScreenId[] = [
  "home",
  "activos",
  "activoDetalle",
  "cartera",
  "comprador",
  "operador",
  "verificador",
  "puente",
];

describe("getScreenHelp", () => {
  it("returns non-empty ES and EN help for every screen", () => {
    for (const screen of SCREENS) {
      const es = getScreenHelp(screen, "es");
      const en = getScreenHelp(screen, "en");
      expect(es.summary.length).toBeGreaterThan(20);
      expect(en.summary.length).toBeGreaterThan(20);
      expect(es.items.length).toBeGreaterThan(0);
      expect(en.items.length).toBe(es.items.length);
      for (const item of es.items) {
        expect(item.title.length).toBeGreaterThan(0);
        expect(item.body.length).toBeGreaterThan(10);
      }
    }
  });
});
