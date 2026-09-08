/** Dashapps registry data contract schema and production registration. */
import type { IdentityKeyManager } from "../../../../setupDashClient-core.mjs";
import type { Logger } from "../lib/logger";
import type { SessionSdk } from "../session/types";
import { loadSdkModule } from "./sdkModule";
import { seedSystemContractMetadata } from "./registryWrites";

export const DOCUMENT_TYPE = "appMetadata";
export const APP_METADATA_SCHEMAS = {
  [DOCUMENT_TYPE]: {
    type: "object",
    documentsMutable: true,
    canBeDeleted: true,
    properties: {
      contractId: {
        type: "array",
        byteArray: true,
        minItems: 32,
        maxItems: 32,
        contentMediaType: "application/x.dash.dpp.identifier",
        position: 0,
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
        name: "byContractCreated",
        properties: [{ contractId: "asc" }, { $createdAt: "asc" }],
      },
      { name: "byName", properties: [{ name: "asc" }] },
      { name: "recent", properties: [{ $createdAt: "asc" }] },
      {
        name: "byCategoryCreated",
        properties: [{ category: "asc" }, { $createdAt: "asc" }],
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
export const DECLARED_METADATA = {
  description: "Community metadata registry for Dash Platform applications",
  keywords: ["registry", "apps", "dapps"],
};

export async function registerContract({
  sdk,
  keyManager,
  log,
}: {
  sdk: SessionSdk;
  keyManager: IdentityKeyManager;
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
  const candidate = new DataContract({
    ownerId: identity.id,
    identityNonce: BigInt(nonce ?? 0) + 1n,
    schemas: APP_METADATA_SCHEMAS,
    fullValidation: true,
  });
  (
    candidate as unknown as { setConfig(config: Record<string, unknown>): void }
  ).setConfig(CONTRACT_CONFIG);
  const dataContract = DataContract.fromObject(
    {
      ...candidate.toObject(sdk.version()),
      ...DECLARED_METADATA,
      $formatVersion: "1",
    },
    true,
    sdk.version(),
  );
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
