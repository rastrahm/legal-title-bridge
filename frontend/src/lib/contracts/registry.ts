/**
 * On-chain registry calls via MetaMask (Identity / Attestation / Title).
 */

import { Contract, Interface, type TransactionResponse } from "ethers";

import type { AssertionFields } from "@/lib/eip712/identity";
import { buildAssertionTypedData } from "@/lib/eip712/identity";
import type { AttestationFields } from "@/lib/eip712/attestation";
import { buildAttestationTypedData } from "@/lib/eip712/attestation";
import { formatRegistryError } from "@/lib/contracts/registry-errors";
import { getMetaMaskBrowserProvider } from "@/lib/wallets/provider";

const IDENTITY_ABI = [
  "function registerAssertion((bytes32 holder,uint16 country,uint8 investorType,uint64 expiry) assertion,bytes signature)",
  "function hashAssertion((bytes32 holder,uint16 country,uint8 investorType,uint64 expiry) assertion) view returns (bytes32)",
  "function isVerified(bytes32 holder) view returns (bool)",
] as const;

const ATTEST_ABI = [
  "function attest(bytes32 assetId,uint8 kind,uint64 expiry,bytes signature)",
  "function hashAttestation(bytes32 assetId,uint8 kind,uint64 expiry) view returns (bytes32)",
  "function isCertified(bytes32 assetId) view returns (bool)",
] as const;

const TITLE_ABI = [
  "function createAsset(bytes32 assetId)",
  "function issue(bytes32 assetId,uint256 amount,bytes32 toHolder)",
  "function assetState(bytes32 assetId) view returns (uint8)",
  "function balanceOf(bytes32 assetId,bytes32 holder) view returns (uint256)",
] as const;

export const titleIface = new Interface([
  ...TITLE_ABI,
  "function pause()",
]);

/**
 * Sign Assertion EIP-712 with MetaMask and submit registerAssertion.
 */
export async function registerAssertionOnChain(
  identityAddress: string,
  assertion: AssertionFields,
): Promise<{ signature: string; txHash: string }> {
  const provider = getMetaMaskBrowserProvider();
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  const typed = buildAssertionTypedData(identityAddress, chainId, assertion);
  const signature = await signer.signTypedData(
    typed.domain,
    typed.types,
    typed.message,
  );
  const identity = new Contract(identityAddress, IDENTITY_ABI, signer);
  const tx = (await identity.registerAssertion(
    {
      holder: assertion.holder,
      country: assertion.country,
      investorType: assertion.investorType,
      expiry: assertion.expiry,
    },
    signature,
  )) as TransactionResponse;
  const receipt = await tx.wait();
  return { signature, txHash: receipt?.hash ?? tx.hash };
}

/**
 * Sign Attestation EIP-712 and submit attest (CERTIFIER_ROLE required).
 */
export async function attestOnChain(
  attestationAddress: string,
  fields: AttestationFields,
): Promise<{ signature: string; txHash: string }> {
  const provider = getMetaMaskBrowserProvider();
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  const typed = buildAttestationTypedData(attestationAddress, chainId, fields);
  const signature = await signer.signTypedData(
    typed.domain,
    typed.types,
    typed.message,
  );
  const attest = new Contract(attestationAddress, ATTEST_ABI, signer);
  const tx = (await attest.attest(
    fields.assetId,
    fields.kind,
    fields.expiry,
    signature,
  )) as TransactionResponse;
  const receipt = await tx.wait();
  return { signature, txHash: receipt?.hash ?? tx.hash };
}

/**
 * createAsset (if Unknown) then issue. Never swallows create failures:
 * a silent skip left assets Unknown and issue reverted AssetNotActive.
 */
export async function createAssetAndIssueOnChain(
  titleAddress: string,
  assetId: string,
  amount: bigint,
  toHolder: string,
): Promise<{ createTxHash: string | null; issueTxHash: string }> {
  const provider = getMetaMaskBrowserProvider();
  const signer = await provider.getSigner();
  const titles = new Contract(titleAddress, TITLE_ABI, signer);

  let createTxHash: string | null = null;
  try {
    const state = Number(await titles.assetState(assetId));
    // 0 = Unknown → must create; 1 = Active → skip; else cannot issue.
    if (state === 0) {
      const createTx = (await titles.createAsset(
        assetId,
      )) as TransactionResponse;
      const createReceipt = await createTx.wait();
      createTxHash = createReceipt?.hash ?? createTx.hash;
    } else if (state !== 1) {
      throw new Error(
        `AssetNotActive: el lote no está Active (state=${state}).`,
      );
    }

    const issueTx = (await titles.issue(
      assetId,
      amount,
      toHolder,
    )) as TransactionResponse;
    const issueReceipt = await issueTx.wait();
    return {
      createTxHash,
      issueTxHash: issueReceipt?.hash ?? issueTx.hash,
    };
  } catch (err: unknown) {
    throw new Error(formatRegistryError(err));
  }
}

/**
 * eth_call simulation of a raw transaction from the connected account.
 */
export async function simulateFromWallet(tx: {
  to: string;
  data: string;
  value?: bigint;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const provider = getMetaMaskBrowserProvider();
    const signer = await provider.getSigner();
    await provider.call({
      to: tx.to,
      data: tx.data,
      from: await signer.getAddress(),
      value: tx.value ?? 0n,
    });
    return { ok: true };
  } catch (e: unknown) {
    return {
      ok: false,
      error: formatRegistryError(e),
    };
  }
}

/**
 * Send a prepared TransactionRequest via MetaMask and wait for receipt.
 */
export async function sendPreparedTx(tx: {
  to: string;
  data: string;
  value?: bigint;
}): Promise<string> {
  const provider = getMetaMaskBrowserProvider();
  const signer = await provider.getSigner();
  const sent = await signer.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value ?? 0n,
  });
  const receipt = await sent.wait();
  return receipt?.hash ?? sent.hash;
}
