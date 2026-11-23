import { afterEach, describe, expect, it, vi } from "vitest";

import { hexTimeSuffix, unixSeconds } from "./time";

describe("time helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("unixSeconds floors Date.now to UTC seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T12:00:00.999Z"));
    expect(unixSeconds()).toBe(Math.floor(Date.parse("2026-11-23T12:00:00.999Z") / 1000));
  });

  it("hexTimeSuffix returns hex of wall clock ms", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    expect(hexTimeSuffix()).toBe((1_700_000_000_000).toString(16));
  });
});
