import { beforeAll, describe, expect, it } from "vitest";
import {
  APP_METADATA_SCHEMAS,
  buildRegistryContract,
  CONTRACT_CONFIG,
  DECLARED_METADATA,
  DOCUMENT_TYPE,
  ENDORSEMENT_DOCUMENT_TYPE,
  REVIEW_DOCUMENT_TYPE,
} from "../src/dash/contract";
import { APP_CATEGORIES } from "../src/dash/registryReads";

type Index = {
  name: string;
  unique?: boolean;
  properties: readonly Record<string, string>[];
  countable?: string;
  rangeCountable?: boolean;
  summable?: string;
  averageable?: string;
  rangeAverageable?: boolean;
  rankedCountable?: unknown;
  rankedSummable?: unknown;
  rankedAverageable?: unknown;
};
type RefersTo = {
  type: string;
  documentType?: string;
  contractRequirements?: Record<string, unknown>;
  findBy?: Record<string, string>;
};
type Property = {
  type: string;
  position: number;
  refersTo?: RefersTo;
  [key: string]: unknown;
};
type Schema = {
  type: string;
  documentsMutable?: boolean;
  canBeDeleted?: boolean | string;
  documentsKeepHistory?: boolean;
  transferable?: number;
  tradeMode?: number;
  immutable?: readonly string[];
  properties: Record<string, Property>;
  required: readonly string[];
  additionalProperties: boolean;
  indices: readonly Index[];
};
type Schemas = Record<string, Schema>;

const schemas = APP_METADATA_SCHEMAS as unknown as Schemas;
const metadata = schemas[DOCUMENT_TYPE];
const endorsement = schemas[ENDORSEMENT_DOCUMENT_TYPE];
const review = schemas[REVIEW_DOCUMENT_TYPE];
const IDENTIFIER = {
  type: "array",
  byteArray: true,
  minItems: 32,
  maxItems: 32,
  contentMediaType: "application/x.dash.dpp.identifier",
};

const path = (index: Index) =>
  index.properties.map((property) => Object.keys(property)[0]);
const isRanked = (index: Index) =>
  Boolean(
    index.rankedCountable || index.rankedSummable || index.rankedAverageable,
  );
// `averageable` is countable + summable; `rangeCountable` implies countable.
const isAggregating = (index: Index) =>
  Boolean(
    (index.countable && index.countable !== "notCountable") ||
    index.rangeCountable ||
    index.summable ||
    index.averageable,
  );

// A ranked [p1…pn] index conflicts with an aggregating index on [p1…pn-1].
function rankedPrefixConflicts(indices: readonly Index[]): string[] {
  const conflicts: string[] = [];
  for (const ranked of indices) {
    const rankedPath = path(ranked);
    if (!isRanked(ranked) || rankedPath.length < 2) continue;
    const prefix = rankedPath.slice(0, -1);
    for (const other of indices) {
      if (other === ranked || !isAggregating(other)) continue;
      const otherPath = path(other);
      if (
        otherPath.length === prefix.length &&
        otherPath.every((segment, position) => segment === prefix[position])
      )
        conflicts.push(`${ranked.name} ↔ ${other.name}`);
    }
  }
  return conflicts;
}

describe("registry document types", () => {
  it("declares exactly appMetadata, appEndorsement and appReview", () => {
    expect(Object.keys(APP_METADATA_SCHEMAS)).toEqual([
      "appMetadata",
      "appEndorsement",
      "appReview",
    ]);
    expect([
      DOCUMENT_TYPE,
      ENDORSEMENT_DOCUMENT_TYPE,
      REVIEW_DOCUMENT_TYPE,
    ]).toEqual(["appMetadata", "appEndorsement", "appReview"]);
  });

  it("numbers every type's properties 0…n-1 and allows no extras", () => {
    for (const schema of Object.values(schemas)) {
      expect(schema.type).toBe("object");
      expect(schema.additionalProperties).toBe(false);
      const positions = Object.values(schema.properties)
        .map((property) => property.position)
        .sort((left, right) => left - right);
      expect(positions).toEqual(positions.map((_, index) => index));
    }
  });

  it("keeps every type mutable and deletable with no history", () => {
    for (const schema of Object.values(schemas)) {
      expect(schema.documentsMutable).toBe(true);
      expect(schema.canBeDeleted).toBe(true);
      expect(schema).not.toHaveProperty("documentsKeepHistory");
    }
  });

  it("never combines history with deletion", () => {
    // A history-keeping type must not be deletable; the parser rejects it.
    for (const schema of Object.values(schemas))
      if (schema.documentsKeepHistory) expect(schema.canBeDeleted).toBe(false);
  });

  it("makes appMetadata and appEndorsement neither transferable nor tradeable", () => {
    for (const schema of [metadata, endorsement]) {
      expect([0, undefined]).toContain(schema.transferable);
      expect([0, undefined]).toContain(schema.tradeMode);
    }
    expect(metadata).toMatchObject({ transferable: 0, tradeMode: 0 });
    expect(endorsement).toMatchObject({ transferable: 0, tradeMode: 0 });
    expect(review).not.toHaveProperty("transferable");
    expect(review).not.toHaveProperty("tradeMode");
  });

  it("freezes every contractId and nothing else", () => {
    for (const schema of Object.values(schemas)) {
      expect(schema.immutable).toEqual(["contractId"]);
      expect(schema.required).toContain("contractId");
    }
  });

  it("gives every contractId the identifier shape at position 0", () => {
    for (const schema of Object.values(schemas))
      expect(schema.properties.contractId).toMatchObject({
        ...IDENTIFIER,
        position: 0,
      });
  });
});

describe("appMetadata", () => {
  it("keeps the existing property set, with contractId referring to a contract", () => {
    expect(
      Object.entries(metadata.properties).map(([name, { position }]) => [
        name,
        position,
      ]),
    ).toEqual([
      ["contractId", 0],
      ["name", 1],
      ["description", 2],
      ["website", 3],
      ["repository", 4],
      ["docs", 5],
      ["tagline", 6],
      ["category", 7],
      ["tags", 8],
      ["appUrl", 9],
      ["iconUrl", 10],
    ]);
    // The WASM parser doesn't apply the node's limits, so pin every one.
    const url = (position: number) => ({
      type: "string",
      maxLength: 256,
      pattern: "^https?://",
      position,
    });
    expect(metadata.properties).toEqual({
      contractId: {
        ...IDENTIFIER,
        position: 0,
        refersTo: { type: "contract" },
      },
      name: { type: "string", minLength: 1, maxLength: 63, position: 1 },
      description: { type: "string", maxLength: 1000, position: 2 },
      website: url(3),
      repository: url(4),
      docs: url(5),
      tagline: { type: "string", minLength: 1, maxLength: 120, position: 6 },
      category: {
        type: "string",
        maxLength: 63,
        enum: [...APP_CATEGORIES],
        position: 7,
      },
      tags: {
        type: "string",
        maxLength: 164,
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*(?:,[a-z0-9]+(?:-[a-z0-9]+)*){0,4}$",
        position: 8,
      },
      appUrl: url(9),
      iconUrl: {
        type: "string",
        maxLength: 256,
        pattern: "^https://",
        position: 10,
      },
    });
  });

  it("requires the timestamps, target, name, tagline and category", () => {
    expect(metadata.required).toEqual([
      "$createdAt",
      "$updatedAt",
      "contractId",
      "name",
      "tagline",
      "category",
    ]);
  });

  it("pins every index", () => {
    expect(metadata.indices).toEqual([
      {
        name: "ownerContract",
        unique: true,
        properties: [{ $ownerId: "asc" }, { contractId: "asc" }],
      },
      {
        name: "contractEntries",
        properties: [{ contractId: "asc" }],
        countable: "countable",
        rangeCountable: true,
      },
      {
        name: "contractRecent",
        properties: [{ contractId: "asc" }, { $updatedAt: "asc" }],
      },
      { name: "recent", properties: [{ $createdAt: "asc" }] },
      {
        name: "byCategoryRecent",
        properties: [{ category: "asc" }, { $createdAt: "asc" }],
      },
      { name: "byName", properties: [{ name: "asc" }] },
      {
        name: "byOwner",
        properties: [{ $ownerId: "asc" }, { $updatedAt: "asc" }],
      },
    ]);
  });
});

describe("appEndorsement", () => {
  it("lets only the target contract's owner endorse one publisher entry", () => {
    expect(endorsement.properties).toEqual({
      contractId: {
        ...IDENTIFIER,
        position: 0,
        refersTo: { type: "contract", contractRequirements: { owner: "self" } },
      },
      publisherId: {
        ...IDENTIFIER,
        position: 1,
        refersTo: {
          type: "deletableDocument",
          documentType: "appMetadata",
          findBy: { $ownerId: ".", contractId: "contractId" },
        },
      },
    });
  });

  it("requires publisherId and never freezes it", () => {
    // Not immutable: a node refuses an immutable `findBy` reference.
    expect(endorsement.required).toEqual([
      "$createdAt",
      "$updatedAt",
      "contractId",
      "publisherId",
    ]);
    expect(endorsement.immutable).not.toContain("publisherId");
  });

  it("pins every index", () => {
    expect(endorsement.indices).toEqual([
      {
        name: "byContract",
        unique: true,
        properties: [{ contractId: "asc" }],
      },
      { name: "byPublisher", properties: [{ publisherId: "asc" }] },
      { name: "recent", properties: [{ $createdAt: "asc" }] },
      {
        name: "byOwner",
        properties: [{ $ownerId: "asc" }, { $updatedAt: "asc" }],
      },
    ]);
  });
});

describe("appReview", () => {
  it("bounds stars to 1–5 and blocks the contract owner from reviewing", () => {
    expect(review.properties).toEqual({
      contractId: {
        ...IDENTIFIER,
        position: 0,
        refersTo: {
          type: "contract",
          contractRequirements: { owner: "other" },
        },
      },
      stars: { type: "integer", minimum: 1, maximum: 5, position: 1 },
      title: { type: "string", maxLength: 120, position: 2 },
      body: { type: "string", maxLength: 1000, position: 3 },
    });
    expect(review.required).toEqual([
      "$createdAt",
      "$updatedAt",
      "contractId",
      "stars",
    ]);
  });

  it("pins every index, with contractStars unranked", () => {
    expect(review.indices).toEqual([
      {
        name: "ownerContract",
        unique: true,
        properties: [{ $ownerId: "asc" }, { contractId: "asc" }],
      },
      {
        name: "ownerRecent",
        properties: [{ $ownerId: "asc" }, { $updatedAt: "asc" }],
      },
      {
        name: "contractRating",
        properties: [{ contractId: "asc" }],
        averageable: "stars",
        rangeAverageable: true,
        rankedAverageable: true,
        rankedCountable: true,
      },
      {
        name: "contractStars",
        properties: [{ contractId: "asc" }, { stars: "asc" }],
        countable: "countable",
        rangeCountable: true,
      },
      {
        name: "contractRecent",
        properties: [{ contractId: "asc" }, { $updatedAt: "asc" }],
      },
      {
        name: "contractStarsRecent",
        properties: [
          { contractId: "asc" },
          { stars: "asc" },
          { $updatedAt: "asc" },
        ],
      },
    ]);
  });
});

describe("structural rules a node enforces", () => {
  it("has no ranked index whose n-1 prefix ends an aggregating index", () => {
    for (const schema of Object.values(schemas))
      expect(rankedPrefixConflicts(schema.indices)).toEqual([]);
  });

  it("flags a ranked [contractId, stars]", () => {
    const rankedStars = review.indices.map((index) =>
      index.name === "contractStars"
        ? { ...index, rankedCountable: true }
        : index,
    );
    expect(rankedPrefixConflicts(rankedStars)).toEqual([
      "contractStars ↔ contractRating",
    ]);
  });

  it("satisfies every findBy precondition on the referenced type", () => {
    let checked = 0;
    for (const [typeName, schema] of Object.entries(schemas))
      for (const [propertyName, property] of Object.entries(
        schema.properties,
      )) {
        const reference = property.refersTo;
        if (!reference?.findBy) continue;
        checked += 1;
        const target = schemas[reference.documentType ?? ""];
        expect(target, `${typeName}.${propertyName}`).toBeDefined();
        const keys = Object.keys(reference.findBy).sort();
        // Exactly the properties of one unique index of the target.
        const matching = target.indices.filter(
          (index) =>
            index.unique && [...path(index)].sort().join() === keys.join(),
        );
        expect(matching).toHaveLength(1);
        // Every schema key fixed on the target…
        for (const key of keys.filter((key) => !key.startsWith("$")))
          expect(target.immutable).toContain(key);
        // …and $ownerId only on a type that can't be transferred or traded.
        if (keys.includes("$ownerId")) {
          expect([0, undefined]).toContain(target.transferable);
          expect([0, undefined]).toContain(target.tradeMode);
        }
        for (const source of Object.values(reference.findBy))
          expect(schema.required).toContain(
            source === "." ? propertyName : source,
          );
        // A deletableDocument reference found by findBy may not be immutable.
        if (reference.type === "deletableDocument")
          expect(schema.immutable ?? []).not.toContain(propertyName);
      }
    expect(checked).toBe(1);
    expect(
      metadata.indices.find((index) => index.name === "ownerContract"),
    ).toEqual({
      name: "ownerContract",
      unique: true,
      properties: [{ $ownerId: "asc" }, { contractId: "asc" }],
    });
  });
});

describe("contract-level settings", () => {
  it("pins the contract config", () => {
    expect(CONTRACT_CONFIG).toEqual({
      canBeDeleted: false,
      readonly: false,
      keepsHistory: false,
      documentsKeepHistoryContractDefault: false,
      documentsMutableContractDefault: true,
      documentsCanBeDeletedContractDefault: true,
    });
  });

  it("declares a 3–100 byte description and no keywords", () => {
    expect(DECLARED_METADATA).toEqual({
      description: "Community metadata registry for Dash Platform applications",
    });
    const bytes = new TextEncoder().encode(
      DECLARED_METADATA.description,
    ).length;
    expect(bytes).toBeGreaterThanOrEqual(3);
    expect(bytes).toBeLessThanOrEqual(100);
  });
});

// The parser skips meta-schema checks, hence the explicit assertions above.
describe("5.0.1 WASM parser", () => {
  type SdkModule = typeof import("@dashevo/evo-sdk");
  let sdk: SdkModule;
  const OWNER = "7tSPeMiV1eNCGUHJ9RmyUKLvBkHMTspNYDZJwpdqWqJx";
  const parse = (variant: Schemas) =>
    new sdk.DataContract({
      ownerId: OWNER,
      identityNonce: 1n,
      schemas: variant,
      fullValidation: true,
      platformVersion: 14,
    });
  const withType = (name: string, patch: Partial<Schema>): Schemas => ({
    ...schemas,
    [name]: { ...schemas[name], ...patch },
  });

  beforeAll(async () => {
    sdk = await import("@dashevo/evo-sdk");
    await sdk.ensureInitialized();
  }, 60_000);

  it("builds the registration contract: schemas, config, description, no keywords", () => {
    const contract = buildRegistryContract(sdk.DataContract, {
      ownerId: OWNER,
      identityNonce: 1n,
      platformVersion: 14,
    });
    const object = contract.toObject(14);
    expect(Object.keys(object.documentSchemas).sort()).toEqual([
      "appEndorsement",
      "appMetadata",
      "appReview",
    ]);
    expect(object.keywords).toEqual([]);
    expect(object.description).toBe(DECLARED_METADATA.description);
    expect(object.config).toMatchObject(CONTRACT_CONFIG);
    expect(object.config?.keepsHistory).toBe(false);

    const contractId = contract.id.toString();
    // JSON round trip turns the WASM Identifier into its base58 string.
    const references = JSON.parse(
      JSON.stringify(Object.fromEntries(contract.documentReferences)),
    );
    expect(references).toEqual({
      appMetadata: [{ path: "contractId", type: "contract" }],
      appEndorsement: [
        {
          path: "contractId",
          type: "contract",
          contractRequirements: { owner: "self" },
        },
        {
          path: "publisherId",
          type: "deletableDocument",
          contractId,
          documentType: "appMetadata",
          findBy: { $ownerId: ".", contractId: "contractId" },
        },
      ],
      appReview: [
        {
          path: "contractId",
          type: "contract",
          contractRequirements: { owner: "other" },
        },
      ],
    });
    for (const name of Object.keys(schemas))
      expect(contract.documentTypeImmutableProperties(name)).toEqual({
        immutable: ["contractId"],
        immutableWhen: {},
      });
  });

  it("refuses to build for an older platform version", () => {
    expect(() =>
      buildRegistryContract(sdk.DataContract, {
        ownerId: OWNER,
        identityNonce: 1n,
        platformVersion: 13,
      }),
    ).toThrow(/protocol 14/);
  });

  it.each([
    [
      "a ranked [contractId, stars]",
      withType(REVIEW_DOCUMENT_TYPE, {
        indices: review.indices.map((index) =>
          index.name === "contractStars"
            ? { ...index, rankedCountable: true }
            : index,
        ),
      }),
      /compound ranked index `contractStars` conflicts with index `contractRating`/,
    ],
    [
      "history on a deletable endorsement",
      withType(ENDORSEMENT_DOCUMENT_TYPE, { documentsKeepHistory: true }),
      /sets both `documentsKeepHistory: true` and `canBeDeleted: true`/,
    ],
    [
      "a mutable appMetadata.contractId (findBy key can move)",
      withType(DOCUMENT_TYPE, { immutable: [] }),
      /findBy names "contractId" of "appMetadata", which a replace can change/,
    ],
    [
      "a transferable appMetadata (findBy $ownerId can move)",
      withType(DOCUMENT_TYPE, { transferable: 1 }),
      /findBy names "\$ownerId" of "appMetadata", which a transfer or a purchase changes/,
    ],
  ])("rejects %s", (_, variant, error) => {
    expect(() => parse(variant)).toThrow(error);
  });
});
