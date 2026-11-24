import { describe, expect, it } from "vitest";

import {
  buildFirmarHref,
  decodeDvPHandoff,
  encodeDvPHandoff,
  resetDvPHandoffSnapshotCache,
  snapshotDvPHandoffFromHash,
  type DvPHandoffPayload,
} from "./dvp-handoff";

const sample: DvPHandoffPayload = {
  v: 1,
  txBase64: Buffer.from("hello-partial-tx").toString("base64"),
  buyer: "7KAUAQWLudKyUwjfVMoBN7onPEwqDrtddCipZxcsqGTw",
  seller: "EDTzyw3P2wwaLu9VyFUs5EjXziCHaSXCQkbJWhDwM4x5",
  transferIdHex:
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  escrow: "A9j9D6XGUC94SLcpGhK8AyCJReyVu6oGKdD1QRdDm4KU",
  offerTransferId: "0xoffer:abc",
  createdAt: 1_700_000_000,
  lastValidBlockHeight: 512_000_000,
};

describe("dvp-handoff", () => {
  it("round-trips payload through encode/decode", () => {
    const encoded = encodeDvPHandoff(sample);
    expect(encoded.length).toBeGreaterThan(20);
    expect(decodeDvPHandoff(encoded)).toEqual(sample);
  });

  it("rejects garbage", () => {
    expect(decodeDvPHandoff("!!!")).toBeNull();
    expect(decodeDvPHandoff("")).toBeNull();
  });

  it("snapshotDvPHandoffFromHash caches by encoded string", () => {
    resetDvPHandoffSnapshotCache();
    const encoded = encodeDvPHandoff(sample);
    const a = snapshotDvPHandoffFromHash(encoded);
    const b = snapshotDvPHandoffFromHash(encoded);
    expect(a).toEqual(sample);
    expect(a).toBe(b);
    expect(snapshotDvPHandoffFromHash("")).toBeNull();
    expect(snapshotDvPHandoffFromHash("")).toBeNull();
  });

  it("builds firmar href with hash payload", () => {
    const href = buildFirmarHref(sample, "https://localhost:3000");
    expect(href.startsWith("https://localhost:3000/cartera/firmar#")).toBe(
      true,
    );
    const hash = href.split("#")[1]!;
    expect(decodeDvPHandoff(hash)).toEqual(sample);
  });
});
