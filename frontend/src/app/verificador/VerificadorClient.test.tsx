import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Providers } from "@/components/Providers";
import { VerificadorClient } from "./VerificadorClient";

const HOLDER =
  "0xc4596daaf354c9835802d722e528f1852d2e203dbf801838cf8c13d6eb414766";

describe("VerificadorClient", () => {
  it("prefills holder from buyer onboarding", () => {
    render(
      <Providers>
        <VerificadorClient initialHolder={HOLDER} />
      </Providers>,
    );
    expect(screen.getByTestId("id-holder")).toHaveValue(HOLDER);
  });

  it("keeps demo default when holder query is invalid", () => {
    render(
      <Providers>
        <VerificadorClient initialHolder="not-a-bytes32" />
      </Providers>,
    );
    expect(screen.getByTestId("id-holder")).toHaveValue(
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
  });
});
