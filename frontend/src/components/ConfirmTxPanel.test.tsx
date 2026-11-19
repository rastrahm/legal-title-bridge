import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmTxPanel } from "./ConfirmTxPanel";

describe("ConfirmTxPanel", () => {
  it("shows decoded fields and confirms", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmTxPanel
        title="Confirm"
        hint="hint"
        decoded={{
          to: "0x0000000000000000000000000000000000000001",
          value: "0",
          functionName: "issue",
          args: { amount: "5" },
        }}
        simulationOk={true}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByTestId("confirm-fn")).toHaveTextContent("issue");
    expect(screen.getByTestId("confirm-arg-amount")).toHaveTextContent("5");
    await user.click(screen.getByRole("button", { name: /Firmar/i }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
