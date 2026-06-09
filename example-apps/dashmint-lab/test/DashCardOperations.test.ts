import { beforeEach, describe, expect, it, vi } from "vitest";

import { burnCard } from "../src/dash/burnCard";
import { purchaseCard } from "../src/dash/purchaseCard";
import { setPrice } from "../src/dash/setPrice";
import { transferCard } from "../src/dash/transferCard";
import type { DashKeyManager, DashSdk } from "../src/dash/types";

const { mockWithAuthedCard } = vi.hoisted(() => ({
  mockWithAuthedCard: vi.fn(),
}));

vi.mock("../src/dash/withAuthedCard", () => ({
  withAuthedCard: mockWithAuthedCard,
}));

const identity = { id: "buyer-identity" };
const identityKey = { id: "auth-key" };
const signer = { id: "signer" };
const doc = { id: "card-1", revision: 2n };

const baseParams = {
  sdk: {
    documents: {
      transfer: vi.fn(),
      setPrice: vi.fn(),
      purchase: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as DashSdk,
  keyManager: { getAuth: vi.fn() } as unknown as DashKeyManager,
  contractId: "contract-1",
  cardId: "card-1",
  log: vi.fn(),
};

function arrangeAuthedCard() {
  mockWithAuthedCard.mockImplementation(
    async (
      _opts: unknown,
      fn: (ctx: {
        doc?: typeof doc;
        identity: typeof identity;
        identityKey: typeof identityKey;
        signer: typeof signer;
      }) => Promise<void>,
    ) => {
      await fn({ doc, identity, identityKey, signer });
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  arrangeAuthedCard();
});

describe("card operation wrappers", () => {
  it("transferCard validates the recipient before starting a mutation", async () => {
    await expect(
      transferCard({ ...baseParams, recipientId: "" }),
    ).rejects.toThrow("Recipient identity ID is required.");

    expect(mockWithAuthedCard).not.toHaveBeenCalled();
    expect(baseParams.sdk.documents.transfer).not.toHaveBeenCalled();
  });

  it("transferCard passes the fetched document, recipient, auth key, and signer", async () => {
    await transferCard({ ...baseParams, recipientId: "recipient-1" });

    expect(mockWithAuthedCard).toHaveBeenCalledWith(
      {
        sdk: baseParams.sdk,
        keyManager: baseParams.keyManager,
        contractId: "contract-1",
        cardId: "card-1",
        errorLabel: "Transfer error",
        log: baseParams.log,
      },
      expect.any(Function),
    );
    expect(baseParams.sdk.documents.transfer).toHaveBeenCalledWith({
      document: doc,
      recipientId: "recipient-1",
      identityKey,
      signer,
    });
    expect(baseParams.log).toHaveBeenCalledWith(
      "Transferring card card-1 to recipient-1…",
    );
    expect(baseParams.log).toHaveBeenCalledWith("Card transferred!", "success");
  });

  it("setPrice converts numeric prices to bigint and calls documents.setPrice", async () => {
    await setPrice({ ...baseParams, price: 12345 });

    expect(mockWithAuthedCard).toHaveBeenCalledWith(
      expect.objectContaining({
        errorLabel: "Set price error",
        cardId: "card-1",
      }),
      expect.any(Function),
    );
    expect(baseParams.sdk.documents.setPrice).toHaveBeenCalledWith({
      document: doc,
      price: 12345n,
      identityKey,
      signer,
    });
    expect(baseParams.log).toHaveBeenCalledWith(
      "Setting price 12345 credits on card card-1…",
    );
    expect(baseParams.log).toHaveBeenCalledWith("Price set!", "success");
  });

  it("setPrice treats a zero price as removing the sale price", async () => {
    await setPrice({ ...baseParams, price: 0n });

    expect(mockWithAuthedCard).toHaveBeenCalledWith(
      expect.objectContaining({ errorLabel: "Remove price error" }),
      expect.any(Function),
    );
    expect(baseParams.sdk.documents.setPrice).toHaveBeenCalledWith({
      document: doc,
      price: 0n,
      identityKey,
      signer,
    });
    expect(baseParams.log).toHaveBeenCalledWith(
      "Removing price from card card-1…",
    );
    expect(baseParams.log).toHaveBeenCalledWith(
      "Card removed from sale.",
      "success",
    );
  });

  it("purchaseCard submits the current identity as buyerId and preserves bigint prices", async () => {
    await purchaseCard({ ...baseParams, price: 99n });

    expect(mockWithAuthedCard).toHaveBeenCalledWith(
      expect.objectContaining({
        errorLabel: "Purchase error",
        cardId: "card-1",
      }),
      expect.any(Function),
    );
    expect(baseParams.sdk.documents.purchase).toHaveBeenCalledWith({
      document: doc,
      buyerId: "buyer-identity",
      price: 99n,
      identityKey,
      signer,
    });
    expect(baseParams.log).toHaveBeenCalledWith(
      "Purchasing card card-1 for 99 credits…",
    );
    expect(baseParams.log).toHaveBeenCalledWith("Card purchased!", "success");
  });

  it("burnCard skips document prefetch and sends the minimal delete document", async () => {
    await burnCard(baseParams);

    expect(mockWithAuthedCard).toHaveBeenCalledWith(
      {
        sdk: baseParams.sdk,
        keyManager: baseParams.keyManager,
        contractId: "contract-1",
        cardId: "card-1",
        preFetch: false,
        errorLabel: "Burn error",
        log: baseParams.log,
      },
      expect.any(Function),
    );
    expect(baseParams.sdk.documents.delete).toHaveBeenCalledWith({
      document: {
        id: "card-1",
        ownerId: "buyer-identity",
        dataContractId: "contract-1",
        documentTypeName: "card",
      },
      identityKey,
      signer,
    });
    expect(baseParams.log).toHaveBeenCalledWith("Burning card card-1…");
    expect(baseParams.log).toHaveBeenCalledWith("Card burned.", "success");
  });
});
