import type { IdentityPublicKey } from "@dashevo/evo-sdk";
import type { DashKeyManager } from "./types";
import type { SessionSdk } from "../session/types";
import { requireId } from "./ids";
import { loadSdkModule } from "./sdkModule";
import { freshTarget, isDuplicate, prepare, submit } from "./documentWrites";
import {
  isStars,
  ownRating,
  REVIEW_DOCUMENT_TYPE,
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
  original: RatingRecord,
) {
  const { identity, identityKey, signer } = await args.keyManager.getAuth();
  requireKey(identityKey);
  if (identity.id.toString() !== original.ownerId)
    throw new Error("Only the rating owner can edit this rating.");
  const current = await args.sdk.documents.get(
    args.registryId,
    REVIEW_DOCUMENT_TYPE,
    original.id,
  );
  if (!current)
    throw new Error(
      "Your review was removed or replaced since you opened the editor. Reload the page.",
    );
  if (BigInt(current.revision ?? 1) !== original.revision)
    throw new Error(
      "Your review changed since you opened the editor. Reload the page to edit the latest version.",
    );
  const { Document } = await loadSdkModule();
  const draft = new Document({
    properties: ratingProperties(args.targetId, args.input),
    documentTypeName: REVIEW_DOCUMENT_TYPE,
    dataContractId: args.registryId,
    ownerId: identity.id,
    id: original.id,
    revision: BigInt(current.revision ?? 0) + 1n,
  });
  draft.createdAt = current.createdAt;
  draft.updatedAt = BigInt(Date.now());
  const document = await prepare(
    args.sdk,
    args.registryId,
    REVIEW_DOCUMENT_TYPE,
    draft,
  );
  await submit("review", () =>
    args.sdk.documents.replace({ document, identityKey, signer }),
  );
}

const ALREADY_REVIEWED =
  "You reviewed this app since you opened the editor. Reload the page to edit your review.";

/**
 * Create the signed-in identity's rating for a contract, or edit the one the
 * editor was opened with (`original`, null for a first review). The unique
 * `ownerContract` index allows one rating per identity per contract, so a
 * review saved elsewhere in the meantime is a conflict, never overwritten.
 * The network refuses a rating from the contract's own owner.
 */
export async function saveRating(args: {
  sdk: SessionSdk;
  keyManager: DashKeyManager;
  registryId: string;
  targetId: string;
  input: RatingInput;
  original: RatingRecord | null;
}): Promise<"created" | "updated"> {
  const properties = ratingProperties(args.targetId, args.input);
  const contractOwnerId = await freshTarget(args.sdk, args.targetId);
  const { identity, identityKey, signer } = await args.keyManager.getAuth();
  requireKey(identityKey);
  const ownerId = identity.id.toString();
  if (ownerId === contractOwnerId)
    throw new Error("You can't review a contract you own.");
  if (args.original) {
    await replaceRating(args, args.original);
    return "updated";
  }
  if (await ownRating(args.sdk, args.registryId, ownerId, args.targetId))
    throw new Error(ALREADY_REVIEWED);
  const { Document } = await loadSdkModule();
  const draft = new Document({
    properties,
    documentTypeName: REVIEW_DOCUMENT_TYPE,
    dataContractId: requireId(args.registryId),
    ownerId: identity.id,
  });
  const document = await prepare(
    args.sdk,
    args.registryId,
    REVIEW_DOCUMENT_TYPE,
    draft,
  );
  try {
    await submit("review", () =>
      args.sdk.documents.create({ document, identityKey, signer }),
    );
  } catch (error) {
    throw isDuplicate(error) ? new Error(ALREADY_REVIEWED) : error;
  }
  return "created";
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
    REVIEW_DOCUMENT_TYPE,
    args.rating.id,
  );
  if (!current) throw new Error("This rating no longer exists.");
  await submit("review", () =>
    args.sdk.documents.delete({ document: current, identityKey, signer }),
  );
}
