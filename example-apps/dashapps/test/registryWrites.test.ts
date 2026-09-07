import { beforeEach, expect, it, vi } from "vitest";
import { createMetadata, editMetadata, withdrawMetadata } from "../src/dash/registryWrites";
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
    this.id = { toString: () => typeof options.id === "string" ? options.id : id(90) };
    this.ownerId = { toString: () => String(options.ownerId) };
    this.revision = typeof options.revision === "bigint" ? options.revision : 1n;
    this.documentTypeName = String(options.documentTypeName);
  }
  toBytes() { return new Uint8Array([1]); }
  static fromBytes() {
    const prepared = new FakeDocument(lastOptions!);
    activeDraft = prepared;
    return prepared;
  }
}
let activeDraft: FakeDocument | null = null;
let lastOptions: Record<string, unknown> | null = null;

function setup(options: { target?: boolean; existing?: FakeDocument } = {}) {
  const ownerId = id(1);
  const targetId = id(2);
  const registryId = id(3);
  const registry = { schemas: { appMetadata: {} } };
  const target = options.target === false ? undefined : { schemas: {} };
  const create = vi.fn();
  const replace = vi.fn();
  const remove = vi.fn();
  const del = vi.fn();
  const query = vi.fn(async () => []);
  const get = vi.fn(async () => options.existing);
  const sdk = {
    version: () => 13,
    contracts: { getMany: vi.fn(async ([value]: string[]) => new Map([[value, value === targetId ? target : registry]])) },
    documents: { query, get, create, replace, delete: del },
    getWasmSdkConnected: vi.fn(async () => ({ removeCachedContract: remove })),
  };
  const auth = {
    identity: { id: { toString: () => ownerId } },
    identityKey: {},
    signer: {},
  };
  const keyManager = { getAuth: vi.fn(async () => auth) };
  return { sdk, keyManager, ownerId, targetId, registryId, create, replace, del, get, remove };
}

const input = { name: " Example ", description: " Description ", website: "https://example.com", repository: "", docs: "" };

beforeEach(() => {
  activeDraft = null;
  lastOptions = null;
  vi.mocked(loadSdkModule).mockResolvedValue({
    Document: class extends FakeDocument {
      constructor(options: Record<string, unknown>) { super(options); lastOptions = options; }
      static fromBytes = FakeDocument.fromBytes;
    },
    Identifier: FakeIdentifier,
    PlatformVersion: class { constructor(public value: number) {} },
  } as never);
});

it("blocks writes when a forced fresh target lookup is absent", async () => {
  const context = setup({ target: false });
  await expect(createMetadata({ sdk: context.sdk as never, keyManager: context.keyManager as never, registryId: context.registryId, targetId: context.targetId, input })).rejects.toThrow("no longer exists");
  expect(context.remove).toHaveBeenCalledOnce();
  expect(context.keyManager.getAuth).not.toHaveBeenCalled();
  expect(context.create).not.toHaveBeenCalled();
});

it("prepares identifier metadata and classifies a uniqueness race", async () => {
  const context = setup();
  context.create.mockRejectedValue({ code: 40105 });
  await expect(createMetadata({ sdk: context.sdk as never, keyManager: context.keyManager as never, registryId: context.registryId, targetId: context.targetId, input })).rejects.toThrow("Edit your existing entry");
  expect(activeDraft?.properties).toMatchObject({ contractId: context.targetId, name: "Example", description: "Description", website: "https://example.com/" });
});

it("increments the network revision for edits and deletes the fetched document", async () => {
  const current = new FakeDocument({ properties: { contractId: id(2), name: "Old" }, id: id(4), ownerId: id(1), revision: 7n, documentTypeName: "appMetadata" });
  current.createdAt = 100n;
  const context = setup({ existing: current });
  const entry = { id: id(4), ownerId: context.ownerId, contractId: context.targetId, name: "Old", revision: 7n };
  await editMetadata({ sdk: context.sdk as never, keyManager: context.keyManager as never, registryId: context.registryId, targetId: context.targetId, entry, input });
  expect(activeDraft?.revision).toBe(8n);
  expect(context.replace).toHaveBeenCalledOnce();
  await withdrawMetadata({ sdk: context.sdk as never, keyManager: context.keyManager as never, registryId: context.registryId, targetId: context.targetId, entry });
  expect(context.del).toHaveBeenCalledWith(expect.objectContaining({ document: current }));
});
