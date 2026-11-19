import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMint,
  createAccount,
  mintTo,
  approve,
  getAccount,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";
import { createHash } from "crypto";
import { TitleMirror } from "../target/types/title_mirror";

describe("title_mirror", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.titleMirror as Program<TitleMirror>;
  const admin = (provider.wallet as anchor.Wallet).payer;
  const CONFIG_SEED = Buffer.from("config");
  const ASSET_SEED = Buffer.from("asset");
  const PERMANENT_DELEGATE_SEED = Buffer.from("permanent_delegate");
  const ESCROW_AUTHORITY_SEED = Buffer.from("escrow_authority");
  const ESCROW_SEED = Buffer.from("escrow");

  const ethEndpoint = Buffer.alloc(32, 0x11);
  const localChain = new anchor.BN(100001);
  const remoteChain = new anchor.BN(31337);

  function ethAddr(byte: number): number[] {
    return Array(20).fill(byte);
  }

  function configPda(): PublicKey {
    return PublicKey.findProgramAddressSync([CONFIG_SEED], program.programId)[0];
  }

  function assetPda(assetId: Buffer): PublicKey {
    return PublicKey.findProgramAddressSync([ASSET_SEED, assetId], program.programId)[0];
  }

  const relayers = [ethAddr(1), ethAddr(2), ethAddr(3)];

  it("initialize_config with valid threshold", async () => {
    await program.methods
      .initializeConfig({
        ethEndpoint: Array.from(ethEndpoint),
        localChainId: localChain,
        remoteChainId: remoteChain,
        threshold: 2,
        relayers,
        hardDeadlineSecs: new anchor.BN(2), // short offset for DVP tests (prod: 7d)
      })
      .accountsPartial({
        admin: admin.publicKey,
        config: configPda(),
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const cfg = await program.account.config.fetch(configPda());
    expect(cfg.threshold).to.equal(2);
    expect(cfg.relayerCount).to.equal(3);
    expect(cfg.epoch.toNumber()).to.equal(1);
  });

  it("R6: rejects Harmony-style 2-of-5 threshold", async () => {
    // Use a fresh program state — config already exists; rotate instead
    const five = [ethAddr(10), ethAddr(11), ethAddr(12), ethAddr(13), ethAddr(14)];
    try {
      await program.methods
        .rotateRelayers({ threshold: 2, relayers: five })
        .accountsPartial({
          admin: admin.publicKey,
          config: configPda(),
        })
        .rpc();
      expect.fail("should have rejected threshold");
    } catch (e: any) {
      expect(String(e)).to.match(/ThresholdTooLow|custom program error/i);
    }
  });

  it("rotate_relayers bumps epoch with valid quorum params", async () => {
    const next = [ethAddr(4), ethAddr(5), ethAddr(6)];
    await program.methods
      .rotateRelayers({ threshold: 2, relayers: next })
      .accountsPartial({
        admin: admin.publicKey,
        config: configPda(),
      })
      .rpc();
    const cfg = await program.account.config.fetch(configPda());
    expect(cfg.epoch.toNumber()).to.equal(2);
    expect(cfg.relayerCount).to.equal(3);
  });

  it("initialize_asset creates Token-2022 mint with PDA mint authority", async () => {
    const mint = Keypair.generate();
    const assetId = createHash("sha256").update("lot-1").digest();
    const [permanentDelegate] = PublicKey.findProgramAddressSync(
      [PERMANENT_DELEGATE_SEED, mint.publicKey.toBuffer()],
      program.programId
    );
    const [escrowAuthority] = PublicKey.findProgramAddressSync(
      [ESCROW_AUTHORITY_SEED, mint.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initializeAsset(Array.from(assetId), 0)
      .accountsPartial({
        admin: admin.publicKey,
        config: configPda(),
        permanentDelegate,
        escrowAuthority,
        mint: mint.publicKey,
        asset: assetPda(assetId),
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([mint])
      .rpc();

    const asset = await program.account.asset.fetch(assetPda(assetId));
    expect(asset.mint.toBase58()).to.equal(mint.publicKey.toBase58());
    expect(asset.permanentDelegate.toBase58()).to.equal(permanentDelegate.toBase58());
    expect(asset.issued.toNumber()).to.equal(0);
  });

  it("I5: assert_transfer_path allows permanent delegate and rejects strangers (R4 mint check)", async () => {
    const mint = Keypair.generate();
    const assetId = createHash("sha256").update("lot-i5").digest();
    const [permanentDelegate] = PublicKey.findProgramAddressSync(
      [PERMANENT_DELEGATE_SEED, mint.publicKey.toBuffer()],
      program.programId
    );
    const [escrowAuthority] = PublicKey.findProgramAddressSync(
      [ESCROW_AUTHORITY_SEED, mint.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initializeAsset(Array.from(assetId), 0)
      .accountsPartial({
        admin: admin.publicKey,
        config: configPda(),
        permanentDelegate,
        escrowAuthority,
        mint: mint.publicKey,
        asset: assetPda(assetId),
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([mint])
      .rpc();

    await program.methods
      .assertTransferPath()
      .accountsPartial({
        authority: permanentDelegate,
        mint: mint.publicKey,
        asset: assetPda(assetId),
        permanentDelegate,
        escrowAuthority,
      })
      .rpc();

    const stranger = Keypair.generate().publicKey;
    try {
      await program.methods
        .assertTransferPath()
        .accountsPartial({
          authority: stranger,
          mint: mint.publicKey,
          asset: assetPda(assetId),
          permanentDelegate,
          escrowAuthority,
        })
        .rpc();
      expect.fail("stranger should be rejected");
    } catch (e: any) {
      expect(String(e)).to.match(/UnauthorizedTransferPath|custom program error/i);
    }

    // R4: wrong mint for asset
    const otherMint = Keypair.generate();
    try {
      await program.methods
        .assertTransferPath()
        .accountsPartial({
          authority: permanentDelegate,
          mint: otherMint.publicKey,
          asset: assetPda(assetId),
          permanentDelegate,
          escrowAuthority,
        })
        .rpc();
      expect.fail("mint mismatch should fail");
    } catch (e: any) {
      expect(String(e)).to.match(/MintMismatch|Constraint|custom program error|AccountNotInitialized/i);
    }
  });

  it("R3: apply_issue rejects non-Instructions sysvar address", async () => {
    const mint = Keypair.generate();
    const assetId = createHash("sha256").update("lot-r3").digest();
    const [permanentDelegate] = PublicKey.findProgramAddressSync(
      [PERMANENT_DELEGATE_SEED, mint.publicKey.toBuffer()],
      program.programId
    );
    const [escrowAuthority] = PublicKey.findProgramAddressSync(
      [ESCROW_AUTHORITY_SEED, mint.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initializeAsset(Array.from(assetId), 0)
      .accountsPartial({
        admin: admin.publicKey,
        config: configPda(),
        permanentDelegate,
        escrowAuthority,
        mint: mint.publicKey,
        asset: assetPda(assetId),
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([mint])
      .rpc();

    const dest = getAssociatedTokenAddressSync(mint.publicKey, admin.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const createAta = createAssociatedTokenAccountInstruction(
      admin.publicKey,
      dest,
      admin.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    await provider.sendAndConfirm(new Transaction().add(createAta));

    const fakeSysvar = Keypair.generate();
    const messageId = Buffer.alloc(32, 7);
    const wire = Buffer.alloc(62 + 96, 1);

    try {
      await program.methods
        .applyIssue(Array.from(messageId), wire)
        .accountsPartial({
          payer: admin.publicKey,
          config: configPda(),
          asset: assetPda(assetId),
          mint: mint.publicKey,
          permanentDelegate,
          destination: dest,
          processed: PublicKey.findProgramAddressSync(
            [Buffer.from("processed"), messageId],
            program.programId
          )[0],
          instructionsSysvar: fakeSysvar.publicKey, // R3: must be real sysvar
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("fake instructions sysvar must fail");
    } catch (e: any) {
      expect(String(e)).to.match(/InvalidInstructionsSysvar|ConstraintAddress|custom program error/i);
    }

    // Sanity: real sysvar address is the known constant
    expect(SYSVAR_INSTRUCTIONS_PUBKEY.toBase58()).to.equal(
      "Sysvar1nstructions1111111111111111111111111"
    );
  });

  it("pings", async () => {
    const signature = await program.methods.ping().rpc();
    expect(signature).to.be.a("string").and.not.empty;
  });

  it("DVP: request_transfer escrow + P9 refund after hardDeadline + I4 terminal", async () => {
    const seller = Keypair.generate();
    const buyer = Keypair.generate();
    const stranger = Keypair.generate();
    for (const kp of [seller, buyer, stranger]) {
      const sig = await provider.connection.requestAirdrop(kp.publicKey, 2e9);
      await provider.connection.confirmTransaction(sig);
    }

    const mint = Keypair.generate();
    const assetId = createHash("sha256").update("lot-dvp").digest();
    const [permanentDelegate] = PublicKey.findProgramAddressSync(
      [PERMANENT_DELEGATE_SEED, mint.publicKey.toBuffer()],
      program.programId
    );
    const [escrowAuthority] = PublicKey.findProgramAddressSync(
      [ESCROW_AUTHORITY_SEED, mint.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initializeAsset(Array.from(assetId), 0)
      .accountsPartial({
        admin: admin.publicKey,
        config: configPda(),
        permanentDelegate,
        escrowAuthority,
        mint: mint.publicKey,
        asset: assetPda(assetId),
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([mint])
      .rpc();

    const sellerTitleAta = await createAccount(
      provider.connection,
      admin,
      mint.publicKey,
      seller.publicKey,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    await program.methods
      .mintToHolder(new anchor.BN(100))
      .accountsPartial({
        admin: admin.publicKey,
        config: configPda(),
        asset: assetPda(assetId),
        mint: mint.publicKey,
        permanentDelegate,
        destination: sellerTitleAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    const paymentMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      6,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    const buyerPaymentAta = await createAccount(
      provider.connection,
      admin,
      paymentMint,
      buyer.publicKey,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    const sellerPaymentAta = await createAccount(
      provider.connection,
      admin,
      paymentMint,
      seller.publicKey,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    await mintTo(
      provider.connection,
      admin,
      paymentMint,
      buyerPaymentAta,
      admin,
      1_000_000n,
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    // I5 path: seller approves escrow authority to pull title units.
    await approve(
      provider.connection,
      admin,
      sellerTitleAta,
      escrowAuthority,
      seller,
      40,
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    const transferId = createHash("sha256").update("xfer-dvp-1").digest();
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [ESCROW_SEED, transferId],
      program.programId
    );
    const escrowTitleAta = Keypair.generate();
    const escrowPaymentAta = Keypair.generate();
    const deadline = Math.floor(Date.now() / 1000) + 3;

    await program.methods
      .requestTransfer({
        transferId: Array.from(transferId),
        amount: new anchor.BN(40),
        paymentAmount: new anchor.BN(500_000),
        deadline: new anchor.BN(deadline),
        travelRuleHash: Array.from(Buffer.alloc(32, 9)),
      })
      .accountsPartial({
        payer: admin.publicKey,
        seller: seller.publicKey,
        buyer: buyer.publicKey,
        config: configPda(),
        asset: assetPda(assetId),
        titleMint: mint.publicKey,
        escrowAuthority,
        sellerTitleAta,
        escrowTitleAta: escrowTitleAta.publicKey,
        paymentMint,
        buyerPaymentAta,
        escrowPaymentAta: escrowPaymentAta.publicKey,
        escrow: escrowPda,
        titleTokenProgram: TOKEN_2022_PROGRAM_ID,
        paymentTokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller, buyer, escrowTitleAta, escrowPaymentAta])
      .rpc();

    const escrow = await program.account.escrow.fetch(escrowPda);
    expect(escrow.status).to.equal(0); // Pending
    expect(escrow.amount.toNumber()).to.equal(40);
    expect(escrow.hardDeadline.toNumber()).to.equal(deadline + 2);

    // D5: too early for unilateral refund
    try {
      await program.methods
        .refundAfterHardDeadline()
        .accountsPartial({
          caller: stranger.publicKey,
          escrow: escrowPda,
          titleMint: mint.publicKey,
          escrowAuthority,
          escrowTitleAta: escrowTitleAta.publicKey,
          sellerTitleAta,
          paymentMint,
          escrowPaymentAta: escrowPaymentAta.publicKey,
          buyerPaymentAta,
          titleTokenProgram: TOKEN_2022_PROGRAM_ID,
          paymentTokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([stranger])
        .rpc();
      expect.fail("refund before hardDeadline must fail");
    } catch (e: any) {
      expect(String(e)).to.match(/TooEarlyForRefund|custom program error/i);
    }

    // Wait past hardDeadline (config hard_deadline_secs = 2)
    await new Promise((r) => setTimeout(r, 5500));

    // P9: stranger can call; funds go to seller/buyer only
    const sellerTitleBefore = (await getAccount(provider.connection, sellerTitleAta, undefined, TOKEN_2022_PROGRAM_ID))
      .amount;
    const buyerPayBefore = (await getAccount(provider.connection, buyerPaymentAta, undefined, TOKEN_2022_PROGRAM_ID))
      .amount;
    const strangerPayAta = await createAccount(
      provider.connection,
      admin,
      paymentMint,
      stranger.publicKey,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    await program.methods
      .refundAfterHardDeadline()
      .accountsPartial({
        caller: stranger.publicKey,
        escrow: escrowPda,
        titleMint: mint.publicKey,
        escrowAuthority,
        escrowTitleAta: escrowTitleAta.publicKey,
        sellerTitleAta,
        paymentMint,
        escrowPaymentAta: escrowPaymentAta.publicKey,
        buyerPaymentAta,
        titleTokenProgram: TOKEN_2022_PROGRAM_ID,
        paymentTokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([stranger])
      .rpc();

    const escrowAfter = await program.account.escrow.fetch(escrowPda);
    expect(escrowAfter.status).to.equal(2); // Refunded

    const sellerTitleAfter = (await getAccount(provider.connection, sellerTitleAta, undefined, TOKEN_2022_PROGRAM_ID))
      .amount;
    const buyerPayAfter = (await getAccount(provider.connection, buyerPaymentAta, undefined, TOKEN_2022_PROGRAM_ID))
      .amount;
    expect(sellerTitleAfter - sellerTitleBefore).to.equal(40n);
    expect(buyerPayAfter - buyerPayBefore).to.equal(500_000n);
    const strangerBal = (await getAccount(provider.connection, strangerPayAta, undefined, TOKEN_2022_PROGRAM_ID))
      .amount;
    expect(strangerBal).to.equal(0n);

    // I4: second refund fails
    try {
      await program.methods
        .refundAfterHardDeadline()
        .accountsPartial({
          caller: stranger.publicKey,
          escrow: escrowPda,
          titleMint: mint.publicKey,
          escrowAuthority,
          escrowTitleAta: escrowTitleAta.publicKey,
          sellerTitleAta,
          paymentMint,
          escrowPaymentAta: escrowPaymentAta.publicKey,
          buyerPaymentAta,
          titleTokenProgram: TOKEN_2022_PROGRAM_ID,
          paymentTokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([stranger])
        .rpc();
      expect.fail("second refund must fail");
    } catch (e: any) {
      expect(String(e)).to.match(/EscrowNotPending|custom program error/i);
    }

    // unused ATA keeps typecheck quiet if tree-shaken
    expect(sellerPaymentAta).to.be.instanceOf(PublicKey);
  });
});
