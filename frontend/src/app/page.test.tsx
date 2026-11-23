import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Providers } from "@/components/Providers";
import Home from "./page";

describe("Home", () => {
  it("renders brand heading and I2 status", () => {
    render(
      <Providers>
        <Home />
      </Providers>,
    );

    expect(
      screen.getByRole("heading", { name: /Legal Title Bridge/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("home-i2")).toBeInTheDocument();
    expect(screen.getByTestId("help-home")).toBeInTheDocument();
  });
});
