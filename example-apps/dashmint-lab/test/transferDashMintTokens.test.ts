import { describe, expect, it, vi } from "vitest";

import { transferDashMintTokens } from "../src/dash/transferDashMintTokens";
import type { DashKeyManager, DashSdk } from "../src/dash/types";

function makeKeyManager(senderId = "sender-1") {
  return {
    async getAuth() {
      throw new Error("getAuth should not be used for token transfers");
    },
    async getTransfer() {
      return {
        identity: { id: { toString: () => senderId } },
        identityKey: { id: "transfer-key" },
        signer: { id: "transfer-signer" },
      };
    },
  } as unknown as DashKeyManager;
}

function makeSdk() {
  return {
    tokens: {
      transfer: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as DashSdk;
}

describe("transferDashMintTokens", () => {
  it("uses the transfer key and submits the DashMint token transfer", async () => {
    const sdk = makeSdk();
    const keyManager = makeKeyManager("sender-1");
    const log = vi.fn();

    await transferDashMintTokens({
      sdk,
      keyManager,
      contractId: "contract-1",
      recipientId: "recipient-1",
      amount: 3n,
      availableBalance: 5n,
      log,
    });

    expect(sdk.tokens.transfer).toHaveBeenCalledWith({
      dataContractId: "contract-1",
      tokenPosition: 0,
      amount: 3n,
      senderId: "sender-1",
      recipientId: "recipient-1",
      identityKey: { id: "transfer-key" },
      signer: { id: "transfer-signer" },
    });
    expect(log).toHaveBeenCalledWith("DashMint tokens transferred.", "success");
  });

  it("rejects empty recipients before signing", async () => {
    const sdk = makeSdk();
    const keyManager = makeKeyManager();

    await expect(
      transferDashMintTokens({
        sdk,
        keyManager,
        contractId: "contract-1",
        recipientId: "  ",
        amount: 1n,
      }),
    ).rejects.toThrow("Recipient identity ID is required.");
    expect(sdk.tokens.transfer).not.toHaveBeenCalled();
  });

  it("rejects non-positive amounts before signing", async () => {
    const sdk = makeSdk();
    const keyManager = makeKeyManager();

    await expect(
      transferDashMintTokens({
        sdk,
        keyManager,
        contractId: "contract-1",
        recipientId: "recipient-1",
        amount: 0n,
      }),
    ).rejects.toThrow("Amount must be greater than 0.");
    expect(sdk.tokens.transfer).not.toHaveBeenCalled();
  });

  it("rejects amounts above the known local balance", async () => {
    const sdk = makeSdk();
    const keyManager = makeKeyManager();

    await expect(
      transferDashMintTokens({
        sdk,
        keyManager,
        contractId: "contract-1",
        recipientId: "recipient-1",
        amount: 6n,
        availableBalance: 5n,
      }),
    ).rejects.toThrow("Not enough DashMint tokens.");
    expect(sdk.tokens.transfer).not.toHaveBeenCalled();
  });

  it("rejects self-transfers after resolving the sender identity", async () => {
    const sdk = makeSdk();
    const keyManager = makeKeyManager("sender-1");

    await expect(
      transferDashMintTokens({
        sdk,
        keyManager,
        contractId: "contract-1",
        recipientId: "sender-1",
        amount: 1n,
      }),
    ).rejects.toThrow("Cannot transfer tokens to yourself.");
    expect(sdk.tokens.transfer).not.toHaveBeenCalled();
  });
});
