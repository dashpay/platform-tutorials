import { beforeEach, expect, it, vi } from "vitest";
import {
  ratingProperties,
  removeRating,
  saveRating,
} from "../src/dash/ratingWrites";
import { loadSdkModule } from "../src/dash/sdkModule";
import { id } from "./helpers";

vi.mock("../src/dash/sdkModule", () => ({ loadSdkModule: vi.fn() }));

class FakeIdentifier {
  constructor(public value: string) {}
  free() {}
}
class FakeDocument {
  properties: Record<string, unknown>;
  id: { toString(): string };
  ownerId: { toString(): string };
  revision: bigint;
  createdAt?: bigint;
  updatedAt?: bigint;
  entropy = new Uint8Array(32);
  documentTypeName: string;
  constructor(options: Record<string, unknown>) {
    this.properties = options.properties as Record<string, unknown>;
    this.id = {
      toString: () => (typeof options.id === "string" ? options.id : id(90)),
    };
    this.ownerId = { toString: () => String(options.ownerId) };
    this.revision =
      typeof options.revision === "bigint" ? options.revision : 1n;
    this.documentTypeName = String(options.documentTypeName);
  }
  toBytes() {
    return new Uint8Array([1]);
  }
  static fromBytes(
    _bytes: unknown,
    _contract: unknown,
    documentTypeName: string,
  ) {
    const prepared = new FakeDocument({ ...lastOptions!, documentTypeName });
    prepared.createdAt = lastDraft?.createdAt;
    prepared.updatedAt = lastDraft?.updatedAt;
    prepared.revision = lastDraft?.revision ?? prepared.revision;
    activeDraft = prepared;
    return prepared;
  }
}
let activeDraft: FakeDocument | null = null;
let lastDraft: FakeDocument | null = null;
let lastOptions: Record<string, unknown> | null = null;

const ownerId = id(1);
const targetId = id(2);
const registryId = id(3);

function existingRating(stars = 5) {
  return {
    id: id(4),
    ownerId,
    contractId: targetId,
    stars: stars as 5,
    title: "Old title",
    revision: 7n,
    createdAt: 100n,
  };
}

function setup(options: { target?: boolean; existing?: FakeDocument } = {}) {
  const registry = { schemas: { appRating: {} } };
  const target = options.target === false ? undefined : { schemas: {} };
  const create = vi.fn();
  const replace = vi.fn();
  const del = vi.fn();
  const remove = vi.fn();
  const query = vi.fn(async () => [] as unknown[]);
  const get = vi.fn(async () => options.existing);
  const sdk = {
    version: () => 13,
    contracts: {
      getMany: vi.fn(
        async ([value]: string[]) =>
          new Map([[value, value === targetId ? target : registry]]),
      ),
    },
    documents: { query, get, create, replace, delete: del },
    getWasmSdkConnected: vi.fn(async () => ({ removeCachedContract: remove })),
  };
  const auth = {
    identity: { id: { toString: () => ownerId } },
    identityKey: {},
    signer: {},
  };
  const keyManager = { getAuth: vi.fn(async () => auth) };
  return { sdk, keyManager, create, replace, del, get, query, remove };
}

const input = { stars: 4, title: "  Great  ", body: " Works well. " };

beforeEach(() => {
  activeDraft = null;
  lastDraft = null;
  lastOptions = null;
  vi.mocked(loadSdkModule).mockResolvedValue({
    Document: class extends FakeDocument {
      constructor(options: Record<string, unknown>) {
        super(options);
        lastOptions = options;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        lastDraft = this;
      }
      static fromBytes = FakeDocument.fromBytes;
    },
    Identifier: FakeIdentifier,
    PlatformVersion: class {
      constructor(public value: number) {}
    },
  } as never);
});

it("validates stars and trims optional text, omitting blanks", () => {
  expect(ratingProperties(targetId, input)).toEqual({
    contractId: targetId,
    stars: 4,
    title: "Great",
    body: "Works well.",
  });
  expect(
    ratingProperties(targetId, { stars: 5, title: " ", body: "" }),
  ).toEqual({ contractId: targetId, stars: 5 });
  for (const stars of [null, 0, 6, 3.5])
    expect(() => ratingProperties(targetId, { ...input, stars })).toThrow(
      "Choose 1 to 5 stars.",
    );
  expect(() =>
    ratingProperties(targetId, { ...input, title: "x".repeat(121) }),
  ).toThrow("at most 120");
  expect(() =>
    ratingProperties(targetId, { ...input, body: "x".repeat(1001) }),
  ).toThrow("at most 1,000");
});

it("blocks writes when the fresh target lookup is absent", async () => {
  const context = setup({ target: false });
  await expect(
    saveRating({
      sdk: context.sdk as never,
      keyManager: context.keyManager as never,
      registryId,
      targetId,
      input,
    }),
  ).rejects.toThrow("no longer exists");
  expect(context.remove).toHaveBeenCalledOnce();
  expect(context.keyManager.getAuth).not.toHaveBeenCalled();
});

it("creates a prepared rating with a base58 identifier when none exists", async () => {
  const context = setup();
  const result = await saveRating({
    sdk: context.sdk as never,
    keyManager: context.keyManager as never,
    registryId,
    targetId,
    input,
  });
  expect(result).toBe("created");
  expect(context.create).toHaveBeenCalledOnce();
  expect(activeDraft?.properties).toEqual({
    contractId: targetId,
    stars: 4,
    title: "Great",
    body: "Works well.",
  });
  expect(activeDraft?.documentTypeName).toBe("appRating");
  expect(typeof activeDraft?.createdAt).toBe("bigint");
  expect(activeDraft?.entropy).toBeInstanceOf(Uint8Array);
  expect(context.replace).not.toHaveBeenCalled();
});

it("replaces an existing rating, bumping revision and preserving $createdAt", async () => {
  const current = new FakeDocument({
    properties: { contractId: targetId, stars: 5 },
    id: id(4),
    ownerId,
    revision: 7n,
    documentTypeName: "appRating",
  });
  current.createdAt = 100n;
  const context = setup({ existing: current });
  context.query.mockResolvedValue([
    {
      id: id(4),
      ownerId,
      revision: 7n,
      createdAt: 100n,
      properties: { contractId: targetId, stars: 5, title: "Old title" },
    },
  ]);
  const result = await saveRating({
    sdk: context.sdk as never,
    keyManager: context.keyManager as never,
    registryId,
    targetId,
    input,
  });
  expect(result).toBe("updated");
  expect(context.create).not.toHaveBeenCalled();
  expect(context.replace).toHaveBeenCalledOnce();
  expect(context.get).toHaveBeenCalledWith(registryId, "appRating", id(4));
  expect(activeDraft?.revision).toBe(8n);
  expect(activeDraft?.createdAt).toBe(100n);
  expect(activeDraft?.properties).toMatchObject({ stars: 4, title: "Great" });
});

it("resolves a 40105 race by re-reading and replacing the committed rating", async () => {
  const current = new FakeDocument({
    properties: { contractId: targetId, stars: 2 },
    id: id(4),
    ownerId,
    revision: 1n,
    documentTypeName: "appRating",
  });
  const context = setup({ existing: current });
  context.query.mockResolvedValueOnce([]).mockResolvedValueOnce([
    {
      id: id(4),
      ownerId,
      revision: 1n,
      properties: { contractId: targetId, stars: 2 },
    },
  ]);
  context.create.mockRejectedValue({ code: 40105 });
  const result = await saveRating({
    sdk: context.sdk as never,
    keyManager: context.keyManager as never,
    registryId,
    targetId,
    input,
  });
  expect(result).toBe("updated");
  expect(context.replace).toHaveBeenCalledOnce();
  expect(activeDraft?.revision).toBe(2n);
});

it("rethrows non-duplicate create failures", async () => {
  const context = setup();
  context.create.mockRejectedValue(new Error("insufficient balance"));
  await expect(
    saveRating({
      sdk: context.sdk as never,
      keyManager: context.keyManager as never,
      registryId,
      targetId,
      input,
    }),
  ).rejects.toThrow("insufficient balance");
  expect(context.replace).not.toHaveBeenCalled();
});

it("removes only the owner's fetched rating document", async () => {
  const current = new FakeDocument({
    properties: { contractId: targetId, stars: 5 },
    id: id(4),
    ownerId,
    documentTypeName: "appRating",
  });
  const context = setup({ existing: current });
  await removeRating({
    sdk: context.sdk as never,
    keyManager: context.keyManager as never,
    registryId,
    rating: existingRating(),
  });
  expect(context.del).toHaveBeenCalledWith(
    expect.objectContaining({ document: current }),
  );
  await expect(
    removeRating({
      sdk: context.sdk as never,
      keyManager: context.keyManager as never,
      registryId,
      rating: { ...existingRating(), ownerId: id(8) },
    }),
  ).rejects.toThrow("Only the rating owner");
  context.get.mockResolvedValue(undefined);
  await expect(
    removeRating({
      sdk: context.sdk as never,
      keyManager: context.keyManager as never,
      registryId,
      rating: existingRating(),
    }),
  ).rejects.toThrow("no longer exists");
});
