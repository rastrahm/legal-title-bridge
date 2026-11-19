import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDeadlineCountdown } from "./useDeadlineCountdown";

describe("useDeadlineCountdown", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes label before deadline", () => {
    vi.useFakeTimers();
    let now = 1000;
    const { result } = renderHook(() =>
      useDeadlineCountdown(1100, 2000, () => now),
    );
    expect(result.current.phase).toBe("before_deadline");
    expect(result.current.label).toMatch(/h /);

    now = 1500;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.phase).toBe("before_hard");

    now = 2500;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.phase).toBe("past_hard");
    expect(result.current.label).toBe("0h 0m 0s");
  });
});
