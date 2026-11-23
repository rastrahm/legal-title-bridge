import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Providers } from "@/components/Providers";
import { ContextualHelp } from "./ContextualHelp";

describe("ContextualHelp", () => {
  it("shows screen summary when opened", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <ContextualHelp screen="verificador" />
      </Providers>,
    );

    expect(screen.getByTestId("help-verificador")).toBeInTheDocument();
    await user.click(screen.getByTestId("help-toggle-verificador"));
    expect(screen.getByTestId("help-summary-verificador")).toHaveTextContent(
      /EIP-712|identidad|KYC/i,
    );
    expect(screen.getByText(/Firmar identidad/i)).toBeInTheDocument();
  });
});
