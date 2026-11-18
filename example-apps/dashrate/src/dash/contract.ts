/**
 * DashRate review data contract: schema definition + registration.
 *
 * The aggregate/ranked index keywords (averageable, rankedAverageable, …)
 * need document meta-schema v3, i.e. a protocol version 14 network.
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
        // ≤ 59, not 63: an index declaring a ranked axis caps its group key
        // (the property's UTF-8 bytes, up to 4 per char) at 239 bytes. The
        // node enforces this at publish; offline validation does not.
        maxLength: 59,
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
        // One review per identity per resource; a second save edits.
        name: "ownerAndResource",
        unique: true,
        properties: [{ $ownerId: "asc" }, { resourceId: "asc" }],
      },
      {
        // "My reviews", newest first: orderBy $updatedAt desc.
        name: "ownerReviews",
        properties: [{ $ownerId: "asc" }, { $updatedAt: "asc" }],
      },
      {
        // The per-resource aggregate index. `averageable: "rating"` keeps a
        // provable (count, sum) of `rating` per resourceId → documents.average.
        // `rangeAverageable` (= rangeCountable + rangeSummable) is the
        // prerequisite for the two ranked axes (avg and count), which let
        // documents.ranked / documents.having rank resources against each
        // other. They're part of the published contract either way.
        name: "resourceRating",
        properties: [{ resourceId: "asc" }],
        averageable: "rating",
        rangeAverageable: true,
        rankedAverageable: true,
        rankedCountable: true,
      },
      {
        // Per-star histogram (count GROUP BY rating) and the `rating == N`
        // filter. Count-only and NOT ranked: a compound ranked index under the
        // averageable [resourceId] prefix is rejected at registration.
        name: "resourceRatingDistribution",
        properties: [{ resourceId: "asc" }, { rating: "asc" }],
        countable: "countable",
        rangeCountable: true,
      },
      {
        // A resource's reviews newest first, paged server-side
        // (orderBy $updatedAt desc + startAfter).
        name: "resourceRecent",
        properties: [{ resourceId: "asc" }, { $updatedAt: "asc" }],
      },
      {
        // The same, within one star value (the histogram's `rating == N`
        // filter), still newest first and paged.
        name: "resourceRatingRecent",
        properties: [
          { resourceId: "asc" },
          { rating: "asc" },
          { $updatedAt: "asc" },
        ],
      },
    ],
  },
} as const;

const STORAGE_KEY = "dashrate.contractId";

export const DEFAULT_CONTRACT_ID =
  "EJHQrRenbFXEPvhgFXD7v8F2ewkqZ2JEdHGKMshZauxz";

export function loadStoredContractId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_CONTRACT_ID;
  } catch {
    return DEFAULT_CONTRACT_ID;
  }
}

export function saveContractId(contractId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, contractId);
  } catch {
    // Persistence is best-effort (e.g. Safari private mode disables writes).
    // The in-memory contract id still drives the session; don't fail the
    // caller — a successful contract publish must not look like a failure.
  }
}

export function clearStoredContractId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // See saveContractId: storage writes are best-effort.
  }
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
