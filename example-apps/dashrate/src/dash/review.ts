/**
 * Create or update one review per identity/resource pair.
 *
 * SDK methods:
 *   sdk.documents.query(...)
 *   sdk.documents.create(...)
 *   sdk.documents.get(...)
 *   sdk.documents.replace(...)
 */
import { PLATFORM_VERSION_OVERRIDE } from "../../../../platformVersion.mjs";
import type { Logger } from "../lib/logger";
import { loadSdkModule } from "./sdkModule";
import { findMyReviewForResource } from "./queries";
import type { DashKeyManager, DashSdk } from "./types";

export interface SaveReviewParams {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  resourceId: string;
  rating: number;
  reviewText: string;
  log?: Logger;
}

function normalizeRating(rating: number): number {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be an integer from 1 to 5.");
  }
  return rating;
}

export async function saveReview({
  sdk,
  keyManager,
  contractId,
  resourceId,
  rating,
  reviewText,
  log,
}: SaveReviewParams): Promise<string> {
  const normalizedRating = normalizeRating(rating);
  const trimmedText = reviewText.trim();
  const { identity, identityKey, signer } = await keyManager.getAuth();
  const ownerId = identity.id.toString();
  const existing = await findMyReviewForResource({
    sdk,
    contractId,
    resourceId,
    ownerId,
  });
  const { Document } = await loadSdkModule();

  if (!existing) {
    log?.("Creating review...");
    const document = new Document({
      properties: {
        resourceId,
        rating: normalizedRating,
        ...(trimmedText ? { reviewText: trimmedText } : {}),
      },
      documentTypeName: "review",
      dataContractId: contractId,
      ownerId: identity.id,
    });

    await sdk.documents.create({ document, identityKey, signer });
    const json =
      typeof document.toJSON === "function"
        ? (document.toJSON(PLATFORM_VERSION_OVERRIDE) as Record<
            string,
            unknown
          >)
        : {};
    const reviewId = String(json.$id ?? json.id ?? "");
    if (!reviewId) throw new Error("Created review returned no ID.");
    log?.("Review created.", "success");
    return reviewId;
  }

  log?.("Updating review...");
  const networkDoc = await sdk.documents.get(contractId, "review", existing.id);
  if (!networkDoc) {
    throw new Error(`Review ${existing.id} not found.`);
  }
  const revision = BigInt(networkDoc.revision ?? 0) + 1n;
  const replacement = new Document({
    properties: {
      resourceId,
      rating: normalizedRating,
      ...(trimmedText ? { reviewText: trimmedText } : {}),
    },
    documentTypeName: "review",
    dataContractId: contractId,
    ownerId: identity.id,
    id: existing.id,
    revision,
  });

  await sdk.documents.replace({
    document: replacement,
    identityKey,
    signer,
  });
  log?.("Review updated.", "success");
  return existing.id;
}
