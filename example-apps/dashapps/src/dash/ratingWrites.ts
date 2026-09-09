import type { IdentityPublicKey } from "@dashevo/evo-sdk";
import type { DashKeyManager } from "./types";
import type { SessionSdk } from "../session/types";
import { requireId } from "./ids";
import { loadSdkModule } from "./sdkModule";
import { freshTarget, isDuplicate, prepare } from "./documentWrites";
import {
  isStars,
  ownRating,
  RATING_DOCUMENT_TYPE,
  type RatingRecord,
} from "./ratingReads";

export interface RatingInput {
  stars: number | null;
  title: string;
  body: string;
}

export function ratingProperties(targetId: string, input: RatingInput) {
  if (!isStars(input.stars)) throw new Error("Choose 1 to 5 stars.");
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length > 120)
    throw new Error("Review title must be at most 120 characters.");
  if (body.length > 1_000)
    throw new Error("Review must be at most 1,000 characters.");
  return {
    contractId: requireId(targetId),
    stars: input.stars,
    ...(title ? { title } : {}),
    ...(body ? { body } : {}),
  };
}

function requireKey(
  identityKey: IdentityPublicKey | undefined,
): asserts identityKey is IdentityPublicKey {
  if (!identityKey)
    throw new Error(
      "The identity has no usable authentication key for rating writes.",
    );
}

async function replaceRating(
  args: {
    sdk: SessionSdk;
    keyManager: DashKeyManager;
    registryId: string;
    targetId: string;
    input: RatingInput;
  },
  existing: RatingRecord,
) {
  const { identity, identityKey, signer } = await args.keyManager.getAuth();
  requireKey(identityKey);
  if (identity.id.toString() !== existing.ownerId)
    throw new Error("Only the rating owner can edit this rating.");
  const current = await args.sdk.documents.get(
    args.registryId,
    RATING_DOCUMENT_TYPE,
    existing.id,
  );
  if (!current)
    throw new Error("Your rating no longer exists. Refresh and try again.");
  const { Document } = await loadSdkModule();
  const draft = new Document({
    properties: ratingProperties(args.targetId, args.input),
    documentTypeName: RATING_DOCUMENT_TYPE,
    dataContractId: args.registryId,
    ownerId: identity.id,
    id: existing.id,
    revision: BigInt(current.revision ?? 0) + 1n,
  });
  draft.createdAt = current.createdAt;
  draft.updatedAt = BigInt(Date.now());
  const document = await prepare(
    args.sdk,
    args.registryId,
    RATING_DOCUMENT_TYPE,
    draft,
  );
  await args.sdk.documents.replace({ document, identityKey, signer });
}

/**
 * Create the signed-in identity's rating for a contract, or replace the
 * existing one. The unique `ownerContract` index guarantees one rating per
 * identity per contract; a 40105 race is resolved by re-reading and replacing.
 */
export async function saveRating(args: {
  sdk: SessionSdk;
  keyManager: DashKeyManager;
  registryId: string;
  targetId: string;
  input: RatingInput;
}): Promise<"created" | "updated"> {
  const properties = ratingProperties(args.targetId, args.input);
  await freshTarget(args.sdk, args.targetId);
  const { identity, identityKey, signer } = await args.keyManager.getAuth();
  requireKey(identityKey);
  const ownerId = identity.id.toString();
  const existing = await ownRating(
    args.sdk,
    args.registryId,
    ownerId,
    args.targetId,
  );
  if (existing) {
    await replaceRating(args, existing);
    return "updated";
  }
  const { Document } = await loadSdkModule();
  const draft = new Document({
    properties,
    documentTypeName: RATING_DOCUMENT_TYPE,
    dataContractId: requireId(args.registryId),
    ownerId: identity.id,
  });
  const document = await prepare(
    args.sdk,
    args.registryId,
    RATING_DOCUMENT_TYPE,
    draft,
  );
  try {
    await args.sdk.documents.create({ document, identityKey, signer });
    return "created";
  } catch (error) {
    if (!isDuplicate(error)) throw error;
    const committed = await ownRating(
      args.sdk,
      args.registryId,
      ownerId,
      args.targetId,
    );
    if (!committed)
      throw new Error(
        "You already rated this app, but the rating could not be loaded. Refresh and try again.",
      );
    await replaceRating(args, committed);
    return "updated";
  }
}

export async function removeRating(args: {
  sdk: SessionSdk;
  keyManager: DashKeyManager;
  registryId: string;
  rating: RatingRecord;
}) {
  const { identity, identityKey, signer } = await args.keyManager.getAuth();
  requireKey(identityKey);
  if (identity.id.toString() !== args.rating.ownerId)
    throw new Error("Only the rating owner can remove this rating.");
  const current = await args.sdk.documents.get(
    args.registryId,
    RATING_DOCUMENT_TYPE,
    args.rating.id,
  );
  if (!current) throw new Error("This rating no longer exists.");
  await args.sdk.documents.delete({ document: current, identityKey, signer });
}
