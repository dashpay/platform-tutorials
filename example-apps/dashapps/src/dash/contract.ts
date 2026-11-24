/** Dashapps registry data contract schema and production registration. */
import type { DashKeyManager } from "./types";
import type { Logger } from "../lib/logger";
import type { SessionSdk } from "../session/types";
import { loadSdkModule } from "./sdkModule";
import { seedSystemContractMetadata } from "./registryWrites";

// test/contractSchema.test.ts pins this schema; the WASM parser skips the
// node's meta-schema validation, so change the two together.
export const DOCUMENT_TYPE = "appMetadata";
export const ENDORSEMENT_DOCUMENT_TYPE = "appEndorsement";
export const REVIEW_DOCUMENT_TYPE = "appReview";

const IDENTIFIER = {
  type: "array",
  byteArray: true,
  minItems: 32,
  maxItems: 32,
  contentMediaType: "application/x.dash.dpp.identifier",
} as const;

export const APP_METADATA_SCHEMAS = {
  [DOCUMENT_TYPE]: {
    type: "object",
    documentsMutable: true,
    canBeDeleted: true,
    // The endorsement's `findBy` keys ($ownerId, contractId) must never move.
    transferable: 0,
    tradeMode: 0,
    immutable: ["contractId"],
    properties: {
      contractId: {
        ...IDENTIFIER,
        position: 0,
        refersTo: { type: "contract" },
      },
      name: { type: "string", minLength: 1, maxLength: 63, position: 1 },
      description: { type: "string", maxLength: 1000, position: 2 },
      website: {
        type: "string",
        maxLength: 256,
        pattern: "^https?://",
        position: 3,
      },
      repository: {
        type: "string",
        maxLength: 256,
        pattern: "^https?://",
        position: 4,
      },
      docs: {
        type: "string",
        maxLength: 256,
        pattern: "^https?://",
        position: 5,
      },
      tagline: { type: "string", minLength: 1, maxLength: 120, position: 6 },
      category: {
        type: "string",
        maxLength: 63,
        enum: [
          "finance",
          "wallets-payments",
          "social",
          "messaging",
          "games",
          "marketplaces",
          "productivity",
          "developer-tools",
          "data-analytics",
          "identity",
          "governance-community",
          "media",
          "education",
          "utilities",
          "infrastructure",
          "other",
        ],
        position: 7,
      },
      tags: {
        type: "string",
        maxLength: 164,
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*(?:,[a-z0-9]+(?:-[a-z0-9]+)*){0,4}$",
        position: 8,
      },
      appUrl: {
        type: "string",
        maxLength: 256,
        pattern: "^https?://",
        position: 9,
      },
      iconUrl: {
        type: "string",
        maxLength: 256,
        pattern: "^https://",
        position: 10,
      },
    },
    required: [
      "$createdAt",
      "$updatedAt",
      "contractId",
      "name",
      "tagline",
      "category",
    ],
    additionalProperties: false,
    indices: [
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
    ],
  },
  [ENDORSEMENT_DOCUMENT_TYPE]: {
    type: "object",
    documentsMutable: true,
    canBeDeleted: true,
    // A node refuses a transferable or tradeable type with an owner requirement.
    transferable: 0,
    tradeMode: 0,
    // Not `publisherId`: a node refuses an immutable `findBy` reference.
    immutable: ["contractId"],
    properties: {
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
          documentType: DOCUMENT_TYPE,
          findBy: { $ownerId: ".", contractId: "contractId" },
        },
      },
    },
    required: ["$createdAt", "$updatedAt", "contractId", "publisherId"],
    additionalProperties: false,
    indices: [
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
    ],
  },
  [REVIEW_DOCUMENT_TYPE]: {
    type: "object",
    documentsMutable: true,
    canBeDeleted: true,
    immutable: ["contractId"],
    properties: {
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
    },
    required: ["$createdAt", "$updatedAt", "contractId", "stars"],
    additionalProperties: false,
    indices: [
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
        // Must stay unranked: its prefix ends the averageable contractRating.
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
    ],
  },
} as const;
export const CONTRACT_CONFIG = {
  canBeDeleted: false,
  readonly: false,
  keepsHistory: false,
  documentsKeepHistoryContractDefault: false,
  documentsMutableContractDefault: true,
  documentsCanBeDeletedContractDefault: true,
};
// No keywords: each costs 0.1 DASH at registration.
export const DECLARED_METADATA = {
  description: "Community metadata registry for Dash Platform applications",
};

export const REGISTRY_MIN_PROTOCOL_VERSION = 14;

type DataContractClass = Awaited<
  ReturnType<typeof loadSdkModule>
>["DataContract"];
type DataContractInstance = InstanceType<DataContractClass>;

export function buildRegistryContract(
  DataContract: DataContractClass,
  {
    ownerId,
    identityNonce,
    platformVersion,
  }: {
    ownerId: ConstructorParameters<DataContractClass>[0]["ownerId"];
    identityNonce: bigint;
    platformVersion: number;
  },
): DataContractInstance {
  if (platformVersion < REGISTRY_MIN_PROTOCOL_VERSION)
    throw new Error(
      `The registry contract needs platform protocol ${REGISTRY_MIN_PROTOCOL_VERSION}; the SDK is on ${platformVersion}.`,
    );
  const draft = new DataContract({
    ownerId,
    identityNonce,
    schemas: APP_METADATA_SCHEMAS,
    fullValidation: true,
    platformVersion,
  });
  draft.setConfig(CONTRACT_CONFIG, platformVersion);
  return DataContract.fromObject(
    {
      ...draft.toObject(platformVersion),
      ...DECLARED_METADATA,
      $formatVersion: "1",
    },
    true,
    platformVersion,
  );
}

export async function registerContract({
  sdk,
  keyManager,
  log,
}: {
  sdk: SessionSdk;
  keyManager: DashKeyManager;
  log?: Logger;
}): Promise<{
  id: string;
  seeded: number;
  seedFailures: Array<{ name: string; error: unknown }>;
}> {
  log?.("Registering Dashapps registry contract…");
  const { identity, identityKey, signer } = await keyManager.getAuth();
  if (!identityKey)
    throw new Error(
      "The identity has no usable authentication key for contract registration.",
    );
  const nonce = await sdk.identities.nonce(identity.id.toString());
  const { DataContract } = await loadSdkModule();
  const dataContract = buildRegistryContract(DataContract, {
    ownerId: identity.id,
    identityNonce: BigInt(nonce ?? 0) + 1n,
    platformVersion: sdk.version(),
  });
  const published = await sdk.contracts.publish({
    dataContract,
    identityKey,
    signer,
  });
  const contractId =
    published.id?.toString() || published.toJSON?.(sdk.version())?.id;
  if (!contractId) throw new Error("Contract publish returned no ID.");
  log?.(`Dashapps registry registered: ${contractId}`, "success");
  log?.("Adding curated system contract entries…");
  const { seeded, failures: seedFailures } = await seedSystemContractMetadata({
    sdk,
    keyManager,
    registryId: contractId,
  });
  log?.(
    `Added ${seeded} curated system contract ${seeded === 1 ? "entry" : "entries"}.`,
    seedFailures.length ? "info" : "success",
  );
  return { id: contractId, seeded, seedFailures };
}
