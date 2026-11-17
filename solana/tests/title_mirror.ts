import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";

describe("title_mirror", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.titleMirror as Program;

  it("pings", async () => {
    const signature = await program.methods.ping().rpc();

    expect(signature).to.be.a("string").and.not.empty;
  });
});
