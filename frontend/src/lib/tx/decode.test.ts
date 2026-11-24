import { describe, expect, it } from "vitest";

import {
  decodeTransactionRequest,
  encodeIssueCall,
  encodePauseCall,
  LAB_E2E_TO_HOLDER,
  prepareLabIssueTx,
} from "./decode";

describe("decodeTransactionRequest (W4)", () => {
  it("decodes issue calldata independent of form fields", () => {
    const assetId =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const holder =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const data = encodeIssueCall(assetId, 5n, holder);
    const view = decodeTransactionRequest({
      to: "0x0000000000000000000000000000000000000001",
      data,
      value: 0n,
    });
    expect(view.functionName).toBe("issue");
    expect(view.args.amount).toBe("5");
    expect(view.args.toHolder.toLowerCase()).toBe(holder.toLowerCase());
  });

  it("prepareLabIssueTx ignores form spoofing (fixed amount + holder)", () => {
    const assetId =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const tx = prepareLabIssueTx(
      "0x0000000000000000000000000000000000000001",
      assetId,
    );
    expect(tx).not.toBeNull();
    const view = decodeTransactionRequest(tx!);
    expect(view.functionName).toBe("issue");
    expect(view.args.amount).toBe("5");
    expect(view.args.toHolder.toLowerCase()).toBe(LAB_E2E_TO_HOLDER.toLowerCase());
  });

  it("labels empty data as nativeTransfer and pause by name", () => {
    expect(
      decodeTransactionRequest({
        to: "0x0000000000000000000000000000000000000001",
        data: "0x",
      }).functionName,
    ).toBe("nativeTransfer");
    const pause = decodeTransactionRequest({
      to: "0x0000000000000000000000000000000000000001",
      data: encodePauseCall(),
    });
    expect(pause.functionName).toBe("pause");
    expect(
      decodeTransactionRequest({
        to: "0x0000000000000000000000000000000000000001",
        data: "0xdeadbeef",
      }).functionName,
    ).toBe("unknown");
  });
});
