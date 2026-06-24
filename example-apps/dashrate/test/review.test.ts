import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the SDK module loader so the 8 MB WASM bundle is never imported, and
// expose a fake Document that records the constructor args saveReview builds.
const documentArgs: Record<string, unknown>[] = [];

class FakeDocument {
  args: Record<string, unknown>;

  constructor(args: Record<string, unknown>) {
    this.args = args;
    documentArgs.push(args);
  }

  toJSON() {
    // The created document reports its id the way the real SDK does.
    return { $id: "new-review-id", ...this.args };
  }
}

vi.mock("../src/dash/sdkModule", () => ({
  loadSdkModule: async () => ({ Document: FakeDocument }),
}));

// Control whether an existing review is found (create vs. update branch).
const findMyReviewForResource = vi.fn();
vi.mock("../src/dash/queries", () => ({ findMyReviewForResource }));

// Import after the mocks are registered.
const { saveReview } = await import("../src/dash/review");
import type { DashKeyManager, DashSdk } from "../src/dash/types";

function makeKeyManager(): DashKeyManager {
  return {
    identityId: "owner-1",
    getAuth: async () => ({
      identity: { id: { toString: () => "owner-1" } } as never,
      identityKey: undefined,
      signer: {} as never,
    }),
  };
}

function makeSdk(overrides: Partial<DashSdk["documents"]> = {}): DashSdk {
  return {
    documents: {
      create: vi.fn().mockResolvedValue(undefined),
      replace: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      ...overrides,
    },
  } as unknown as DashSdk;
}

beforeEach(() => {
  documentArgs.length = 0;
  findMyReviewForResource.mockReset();
});

describe("saveReview rating validation", () => {
  it.each([0, 6, 2.5, Number.NaN])(
    "rejects out-of-range or non-integer rating %p",
    async (rating) => {
      findMyReviewForResource.mockResolvedValue(null);
      await expect(
        saveReview({
          sdk: makeSdk(),
          keyManager: makeKeyManager(),
          contractId: "c1",
          resourceId: "tokens",
          rating: rating as number,
          reviewText: "",
        }),
      ).rejects.toThrow("Rating must be an integer from 1 to 5.");
    },
  );
});

describe("saveReview create branch", () => {
  it("creates a new review when none exists and returns its id", async () => {
    findMyReviewForResource.mockResolvedValue(null);
    const sdk = makeSdk();

    const id = await saveReview({
      sdk,
      keyManager: makeKeyManager(),
      contractId: "c1",
      resourceId: "tokens",
      rating: 5,
      reviewText: "  Great  ",
    });

    expect(id).toBe("new-review-id");
    expect(sdk.documents.create).toHaveBeenCalledOnce();
    expect(sdk.documents.replace).not.toHaveBeenCalled();
    // The create-vs-update decision hinges on the existing-review lookup
    // being scoped to this contract/resource/owner.
    expect(findMyReviewForResource).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: "c1",
        resourceId: "tokens",
        ownerId: "owner-1",
      }),
    );
    // reviewText is trimmed before storage.
    expect(documentArgs[0]).toMatchObject({
      documentTypeName: "review",
      dataContractId: "c1",
      properties: { resourceId: "tokens", rating: 5, reviewText: "Great" },
    });
  });

  it("omits reviewText entirely when blank or whitespace-only", async () => {
    findMyReviewForResource.mockResolvedValue(null);
    const sdk = makeSdk();

    await saveReview({
      sdk,
      keyManager: makeKeyManager(),
      contractId: "c1",
      resourceId: "tokens",
      rating: 3,
      reviewText: "   ",
    });

    expect(documentArgs[0].properties).toEqual({
      resourceId: "tokens",
      rating: 3,
    });
    expect(documentArgs[0].properties).not.toHaveProperty("reviewText");
  });
});

describe("saveReview update branch", () => {
  it("replaces the existing review and bumps its revision", async () => {
    findMyReviewForResource.mockResolvedValue({ id: "existing-id" });
    const sdk = makeSdk({
      get: vi.fn().mockResolvedValue({ revision: 4 }),
    });

    const id = await saveReview({
      sdk,
      keyManager: makeKeyManager(),
      contractId: "c1",
      resourceId: "tokens",
      rating: 2,
      reviewText: "Changed my mind",
    });

    expect(id).toBe("existing-id");
    expect(sdk.documents.replace).toHaveBeenCalledOnce();
    expect(sdk.documents.create).not.toHaveBeenCalled();
    // The existing revision is read via get(contractId, type, id).
    expect(sdk.documents.get).toHaveBeenCalledWith("c1", "review", "existing-id");
    // Replacement keeps the existing id, bumps revision 4 → 5n, and carries
    // the edited rating AND text through (a dropped update text would slip
    // past an assertion that only checked resourceId/rating).
    expect(documentArgs[0]).toMatchObject({
      id: "existing-id",
      revision: 5n,
      properties: {
        resourceId: "tokens",
        rating: 2,
        reviewText: "Changed my mind",
      },
    });
  });

  it("defaults a missing revision to 0 before bumping (→ 1n)", async () => {
    findMyReviewForResource.mockResolvedValue({ id: "existing-id" });
    const sdk = makeSdk({
      get: vi.fn().mockResolvedValue({}),
    });

    await saveReview({
      sdk,
      keyManager: makeKeyManager(),
      contractId: "c1",
      resourceId: "tokens",
      rating: 1,
      reviewText: "",
    });

    expect(documentArgs[0].revision).toBe(1n);
  });

  it("throws when the existing review can't be fetched for replacement", async () => {
    findMyReviewForResource.mockResolvedValue({ id: "existing-id" });
    const sdk = makeSdk({
      get: vi.fn().mockResolvedValue(undefined),
    });

    await expect(
      saveReview({
        sdk,
        keyManager: makeKeyManager(),
        contractId: "c1",
        resourceId: "tokens",
        rating: 4,
        reviewText: "",
      }),
    ).rejects.toThrow("Review existing-id not found.");
    expect(sdk.documents.replace).not.toHaveBeenCalled();
  });
});
