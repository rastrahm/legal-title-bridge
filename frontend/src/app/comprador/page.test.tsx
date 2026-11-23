import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@/components/Providers";
import { holderIdFromSolanaAddress } from "@/lib/holder";
import CompradorPage from "./page";

vi.mock("@/lib/contracts/identity-read", () => ({
  readIsVerified: vi.fn(async () => "unverified" as const),
}));

describe("CompradorPage", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_E2E = "1";
  });

  it("blocks confirm until Phantom is connected", () => {
    render(
      <Providers>
        <CompradorPage />
      </Providers>,
    );
    expect(screen.getByTestId("btn-buyer-enter")).toBeDisabled();
    expect(screen.getByTestId("buyer-holder")).toHaveTextContent("—");
    expect(screen.getByTestId("link-buyer-verifier")).toHaveAttribute(
      "href",
      "/verificador",
    );
  });

  it("connects Phantom, shows holder, links verifier, and confirms entry", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <CompradorPage />
      </Providers>,
    );

    expect(
      screen.getByRole("heading", { name: /comprador|buyer/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("help-comprador")).toBeInTheDocument();

    await user.click(screen.getByTestId("btn-connect-sol"));
    expect(screen.getByTestId("sol-address")).toHaveTextContent("seller-sol");

    const expectedHolder = holderIdFromSolanaAddress("seller-sol");
    expect(screen.getByTestId("buyer-holder")).toHaveTextContent(expectedHolder);
    expect(screen.getByTestId("link-buyer-verifier")).toHaveAttribute(
      "href",
      `/verificador?holder=${encodeURIComponent(expectedHolder)}`,
    );
    expect(screen.getByTestId("buyer-verify-status")).toHaveTextContent(
      /no verificado|not verified/i,
    );

    await user.click(screen.getByTestId("btn-buyer-enter"));
    expect(screen.getByTestId("buyer-entered")).toBeInTheDocument();
  });
});
