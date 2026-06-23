/**
 * DashRate review data contract: schema definition + registration.
 *
 * SDK methods:
 *   new DataContract({ ownerId, identityNonce, schemas, fullValidation })
 *   sdk.contracts.publish({ dataContract, identityKey, signer })
 */
import { errorMessage, type Logger } from "../lib/logger";
import { loadSdkModule } from "./sdkModule";
import type { DashKeyManager, DashSdk } from "./types";

export const REVIEW_SCHEMAS = {
  review: {
    type: "object",
    documentsMutable: true,
    documentsKeepHistory: true,
    canBeDeleted: false,
    properties: {
      resourceId: {
        type: "string",
        minLength: 1,
        maxLength: 63,
        position: 0,
      },
      rating: {
        type: "integer",
        minimum: 1,
        maximum: 5,
        position: 1,
      },
      reviewText: {
        type: "string",
        maxLength: 1000,
        position: 2,
      },
    },
    required: ["$createdAt", "$updatedAt", "resourceId", "rating"],
    additionalProperties: false,
    indices: [
      {
        name: "ownerAndResource",
        unique: true,
        properties: [{ $ownerId: "asc" }, { resourceId: "asc" }],
      },
      {
        name: "ownerReviews",
        properties: [{ $ownerId: "asc" }, { $updatedAt: "asc" }],
      },
      {
        name: "resourceRatingAggregate",
        properties: [{ resourceId: "asc" }],
        countable: "countable",
        summable: "rating",
      },
    ],
  },
} as const;

const STORAGE_KEY = "dashrate.contractId";

export const DEFAULT_CONTRACT_ID = "";

export function loadStoredContractId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_CONTRACT_ID;
  } catch {
    return DEFAULT_CONTRACT_ID;
  }
}

export function saveContractId(contractId: string): void {
  localStorage.setItem(STORAGE_KEY, contractId);
}

export function clearStoredContractId(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function registerContract({
  sdk,
  keyManager,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  log?: Logger;
}): Promise<string> {
  log?.("Registering DashRate review contract...");
  const { identity, identityKey, signer } = await keyManager.getAuth();
  const identityNonce = await sdk.identities.nonce(identity.id.toString());
  const { DataContract } = await loadSdkModule();
  const dataContract = new DataContract({
    ownerId: identity.id,
    identityNonce: (identityNonce || 0n) + 1n,
    schemas: REVIEW_SCHEMAS,
    fullValidation: true,
  });

  (
    dataContract as unknown as {
      setConfig: (config: Record<string, unknown>) => void;
    }
  ).setConfig({
    canBeDeleted: false,
    readonly: false,
    keepsHistory: false,
    documentsKeepHistoryContractDefault: false,
    documentsMutableContractDefault: true,
    documentsCanBeDeletedContractDefault: false,
  });

  let published: {
    id?: string | { toString(): string };
    toJSON?: () => { id?: string };
  };
  try {
    published = await sdk.contracts.publish({
      dataContract,
      identityKey,
      signer,
    });
  } catch (err) {
    throw new Error(`Contract publish failed: ${errorMessage(err)}`);
  }
  const contractId = published.id?.toString() || published.toJSON?.()?.id;
  if (!contractId) {
    throw new Error("Contract publish returned no ID.");
  }

  saveContractId(contractId);
  log?.(`DashRate contract registered: ${contractId}`, "success");
  return contractId;
}
