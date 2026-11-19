import { describe, expect, it } from "vitest";

import {
  decodeTransactionRequest,
  encodeIssueCall,
  encodePauseCall,
} from "./decode";

describe("decodeTransactionRequest (W4)", () => {
  it("decodes issue calldata independent of form fields", () => {
    const assetId =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const to = "0x2222222222222222222222222222222222222222";
    const data = encodeIssueCall(assetId, to, 5n);
    const view = decodeTransactionRequest({
      to: "0x0000000000000000000000000000000000000001",
      data,
      value: 0n,
    });
    expect(view.functionName).toBe("issue");
    expect(view.args.amount).toBe("5");
    expect(view.args.to.toLowerCase()).toBe(to.toLowerCase());
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
