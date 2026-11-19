import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useLocale } from "./useLocale";

describe("useLocale", () => {
  it("switches locale and persists", () => {
    window.localStorage.clear();
    const { result } = renderHook(() => useLocale("es"));
    expect(result.current.dict.navBridge).toBe("Puente");
    act(() => {
      result.current.setLocale("en");
    });
    expect(result.current.locale).toBe("en");
    expect(window.localStorage.getItem("ltb-locale")).toBe("en");
  });
});
