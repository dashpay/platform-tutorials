import { beforeEach, expect, it, vi } from "vitest";
import { endorse, withdrawEndorsement } from "../src/dash/endorsementWrites";
import { loadSdkModule } from "../src/dash/sdkModule";
import { id } from "./helpers";

vi.mock("../src/dash/sdkModule", () => ({ loadSdkModule: vi.fn() }));

class FakeDocument {
  properties: Record<string, unknown>;
  id?: string;
  revision: bigint;
  createdAt?: bigint;
  updatedAt?: bigint;
  entropy = new Uint8Array(32);
  documentTypeName: string;
  constructor(options: Record<string, unknown>) {
    this.properties = options.properties as Record<string, unknown>;
    this.id = options.id as string | undefined;
    this.revision =
      typeof options.revision === "bigint" ? options.revision : 1n;
    this.documentTypeName = String(options.documentTypeName);
  }
  toBytes() {
    return new Uint8Array([1]);
  }
  static fromBytes() {
    return lastDraft!;
  }
}
let lastDraft: FakeDocument | null = null;

const contractOwner = id(1);
const delegate = id(6);
const contractId = id(2);
const registryId = id(3);

function entryDocument(owner: string) {
  return {
    id: id(40),
    ownerId: owner,
    properties: {
      contractId,
      name: "App",
      tagline: "Tagline",
      category: "other",
    },
  };
}

function endorsementDocument(publisherId: string) {
  return {
    id: id(50),
    ownerId: contractOwner,
    revision: 3n,
    createdAt: 100n,
    properties: { contractId, publisherId },
  };
}

function setup({
  signer = contractOwner,
  entries = [contractOwner, delegate],
  endorsed,
}: { signer?: string; entries?: string[]; endorsed?: string } = {}) {
  const create = vi.fn();
  const replace = vi.fn();
  const del = vi.fn();
  const current = new FakeDocument({
    properties: {},
    id: id(50),
    revision: 3n,
    documentTypeName: "appEndorsement",
  });
  current.createdAt = 100n;
  const get = vi.fn(async () => current);
  const query = vi.fn(
    async (args: {
      documentTypeName: string;
      where: [string, string, string][];
    }) => {
      if (args.documentTypeName === "appEndorsement")
        return endorsed ? [endorsementDocument(endorsed)] : [];
      const owner = args.where[0][2];
      return entries.includes(owner) ? [entryDocument(owner)] : [];
    },
  );
  const sdk = {
    version: () => 14,
    contracts: {
      getMany: vi.fn(
        async ([value]: string[]) =>
          new Map([
            [value, { ownerId: value === contractId ? contractOwner : id(8) }],
          ]),
      ),
    },
    documents: { query, get, create, replace, delete: del },
  };
  const keyManager = {
    getAuth: vi.fn(async () => ({
      identity: { id: { toString: () => signer } },
      identityKey: {},
      signer: {},
    })),
  };
  return {
    args: {
      sdk: sdk as never,
      keyManager: keyManager as never,
      registryId,
      contractId,
    },
    create,
    replace,
    del,
    query,
    current,
  };
}

beforeEach(() => {
  lastDraft = null;
  vi.mocked(loadSdkModule).mockResolvedValue({
    Document: class extends FakeDocument {
      constructor(options: Record<string, unknown>) {
        super(options);
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        lastDraft = this;
      }
      static fromBytes = FakeDocument.fromBytes;
    },
    PlatformVersion: class {
      constructor(public value: number) {}
    },
  } as never);
});

it("creates an endorsement naming the owner's own entry", async () => {
  const context = setup();
  expect(await endorse({ ...context.args, publisherId: contractOwner })).toBe(
    "created",
  );
  expect(context.create).toHaveBeenCalledOnce();
  expect(lastDraft?.documentTypeName).toBe("appEndorsement");
  expect(lastDraft?.properties).toEqual({
    contractId,
    publisherId: contractOwner,
  });
});

it("re-points an existing endorsement to a delegate, keeping $createdAt", async () => {
  const context = setup({ endorsed: contractOwner });
  expect(await endorse({ ...context.args, publisherId: delegate })).toBe(
    "updated",
  );
  expect(context.create).not.toHaveBeenCalled();
  expect(context.replace).toHaveBeenCalledOnce();
  expect(lastDraft?.id).toBe(id(50));
  expect(lastDraft?.revision).toBe(4n);
  expect(lastDraft?.createdAt).toBe(100n);
  expect(lastDraft?.properties).toEqual({ contractId, publisherId: delegate });
});

it("skips the write when the publisher is already endorsed", async () => {
  const context = setup({ endorsed: delegate });
  expect(await endorse({ ...context.args, publisherId: delegate })).toBe(
    "unchanged",
  );
  expect(context.create).not.toHaveBeenCalled();
  expect(context.replace).not.toHaveBeenCalled();
});

it("refuses non-owners and publishers without an entry before broadcasting", async () => {
  const stranger = setup({ signer: delegate });
  await expect(
    endorse({ ...stranger.args, publisherId: delegate }),
  ).rejects.toThrow("Only the contract's owner");
  const missing = setup({ entries: [contractOwner] });
  await expect(
    endorse({ ...missing.args, publisherId: delegate }),
  ).rejects.toThrow("has no entry for this contract");
  expect(stranger.create).not.toHaveBeenCalled();
  expect(missing.create).not.toHaveBeenCalled();
});

it("resolves a 40105 race by re-pointing the committed endorsement", async () => {
  const context = setup();
  const original = context.query.getMockImplementation()!;
  let endorsementReads = 0;
  context.query.mockImplementation(async (args) =>
    args.documentTypeName === "appEndorsement"
      ? endorsementReads++ === 0
        ? []
        : [endorsementDocument(contractOwner)]
      : original(args),
  );
  context.create.mockRejectedValue({ code: 40105 });
  expect(await endorse({ ...context.args, publisherId: delegate })).toBe(
    "updated",
  );
  expect(context.replace).toHaveBeenCalledOnce();
});

it("leaves a 40105 race alone when it already names the publisher", async () => {
  const context = setup();
  const original = context.query.getMockImplementation()!;
  let endorsementReads = 0;
  context.query.mockImplementation(async (args) =>
    args.documentTypeName === "appEndorsement"
      ? endorsementReads++ === 0
        ? []
        : [endorsementDocument(delegate)]
      : original(args),
  );
  context.create.mockRejectedValue({ code: 40105 });
  expect(await endorse({ ...context.args, publisherId: delegate })).toBe(
    "unchanged",
  );
  expect(context.replace).not.toHaveBeenCalled();
});

it("rewords the network refusing a publisher whose entry vanished", async () => {
  const context = setup({ endorsed: contractOwner });
  context.replace.mockRejectedValue({
    code: 40120,
    message: `referenced deletable document (own contract, document type appMetadata, found by $ownerId, contractId) ${delegate} not found for path publisherId`,
  });
  await expect(
    endorse({ ...context.args, publisherId: delegate }),
  ).rejects.toThrow("That publisher has no entry for this contract.");
});

it("lets only the contract owner withdraw an endorsement", async () => {
  const endorsement = {
    id: id(50),
    ownerId: contractOwner,
    contractId,
    publisherId: delegate,
    revision: 3n,
  };
  const context = setup({ endorsed: delegate });
  await withdrawEndorsement({ ...context.args, endorsement });
  expect(context.del).toHaveBeenCalledWith(
    expect.objectContaining({ document: context.current }),
  );
  const stranger = setup({ signer: delegate, endorsed: delegate });
  await expect(
    withdrawEndorsement({ ...stranger.args, endorsement }),
  ).rejects.toThrow("Only the contract's owner");
  expect(stranger.del).not.toHaveBeenCalled();
});
