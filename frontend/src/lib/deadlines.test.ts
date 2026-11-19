import { describe, expect, it } from "vitest";

import { formatCountdown, snapshotDeadlines } from "./deadlines";

describe("deadlines", () => {
  it("classifies phases and formats countdown", () => {
    expect(snapshotDeadlines(100, 200, 50).phase).toBe("before_deadline");
    expect(snapshotDeadlines(100, 200, 150).phase).toBe("before_hard");
    expect(snapshotDeadlines(100, 200, 250).phase).toBe("past_hard");
    expect(formatCountdown(3661)).toBe("1h 1m 1s");
  });
});
