import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@/components/Providers";
import { DEMO_MARKET_STORAGE_KEY } from "@/lib/demo/persist";
import CarteraComprarPage from "./comprar/page";
import CarteraHubPage from "./page";
import CarteraVenderPage from "./vender/page";

vi.mock("@/lib/wallets/env", () => ({
  isE2eLab: () => true,
}));

vi.mock("@/lib/config/network", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/config/network")>(
      "@/lib/config/network",
    );
  return {
    ...actual,
    getActiveNetwork: () => actual.LOCAL_NETWORK,
  };
});

describe("Cartera UX", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_E2E = "1";
    process.env.NEXT_PUBLIC_NETWORK_ID = "local";
    window.sessionStorage.clear();
  });

  it("hub offers Sell and Buy workspaces", () => {
    render(
      <Providers>
        <CarteraHubPage />
      </Providers>,
    );
    expect(screen.getByTestId("card-cartera-vender")).toBeInTheDocument();
    expect(screen.getByTestId("card-cartera-comprar")).toBeInTheDocument();
  });

  it("buy catalog marks lab listing deposit with visible buyer", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <CarteraComprarPage />
      </Providers>,
    );

    await user.click(screen.getByTestId("btn-connect-sol"));
    await user.click(screen.getByTestId("btn-buy"));

    await waitFor(() => {
      expect(screen.getByTestId("wallet-notice")).toHaveTextContent(
        /compra|purchase|oferta|offer|depósito|deposit/i,
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("request-status-0xbb")).toHaveTextContent(
        /depósito|deposit/i,
      );
    });
    expect(screen.getByTestId("request-buyer-0xbb")).toHaveTextContent(
      "seller-sol",
    );
    expect(screen.getByTestId("btn-buy")).toBeDisabled();
  });

  it("persists a published listing across Providers remount", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <Providers>
        <CarteraVenderPage />
      </Providers>,
    );

    await user.click(screen.getByTestId("btn-connect-sol"));
    await user.click(screen.getByTestId("btn-sell"));

    await waitFor(() => {
      expect(window.sessionStorage.getItem(DEMO_MARKET_STORAGE_KEY)).toContain(
        "listing:",
      );
    });
    unmount();

    render(
      <Providers>
        <CarteraComprarPage />
      </Providers>,
    );

    await waitFor(() => {
      expect(screen.getByText(/7 Lab USD/i)).toBeInTheDocument();
    });
  });
});
