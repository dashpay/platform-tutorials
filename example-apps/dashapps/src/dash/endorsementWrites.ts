import type { DashKeyManager } from "./types";
import type { SessionSdk } from "../session/types";
import { requireId } from "./ids";
import { loadSdkModule } from "./sdkModule";
import { freshTarget, isDuplicate, prepare, submit } from "./documentWrites";
import { publisherEntry } from "./registryReads";
import {
  ENDORSEMENT_DOCUMENT_TYPE,
  endorsementFor,
  type Endorsement,
} from "./endorsementReads";

interface EndorseArgs {
  sdk: SessionSdk;
  keyManager: DashKeyManager;
  registryId: string;
  contractId: string;
  publisherId: string;
}

async function ownerAuth(args: {
  sdk: SessionSdk;
  keyManager: DashKeyManager;
  contractId: string;
}) {
  const contractOwnerId = await freshTarget(args.sdk, args.contractId);
  const auth = await args.keyManager.getAuth();
  if (!auth.identityKey)
    throw new Error(
      "The identity has no usable authentication key for endorsement writes.",
    );
  if (auth.identity.id.toString() !== contractOwnerId)
    throw new Error("Only the contract's owner can choose its official entry.");
  return { ...auth, identityKey: auth.identityKey };
}

async function repoint(
  args: EndorseArgs,
  existing: Endorsement,
  { identity, identityKey, signer }: Awaited<ReturnType<typeof ownerAuth>>,
) {
  const current = await args.sdk.documents.get(
    args.registryId,
    ENDORSEMENT_DOCUMENT_TYPE,
    existing.id,
  );
  if (!current)
    throw new Error("The endorsement no longer exists. Refresh and try again.");
  const { Document } = await loadSdkModule();
  const draft = new Document({
    properties: {
      contractId: requireId(args.contractId),
      publisherId: requireId(args.publisherId),
    },
    documentTypeName: ENDORSEMENT_DOCUMENT_TYPE,
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
    ENDORSEMENT_DOCUMENT_TYPE,
    draft,
  );
  await submit("endorsement", () =>
    args.sdk.documents.replace({ document, identityKey, signer }),
  );
}

/**
 * Mark a publisher's entry as the contract's official one: the owner's own
 * entry or a delegate's. Creates the endorsement, or re-points the existing
 * one. The network requires the signer to own the contract and the publisher
 * to have an entry for it.
 */
export async function endorse(
  args: EndorseArgs,
): Promise<"created" | "updated" | "unchanged"> {
  const auth = await ownerAuth(args);
  const { identity, identityKey, signer } = auth;
  if (
    !(await publisherEntry(
      args.sdk,
      args.registryId,
      args.publisherId,
      args.contractId,
    ))
  )
    throw new Error(
      "That publisher has no entry for this contract. They need to publish one first.",
    );
  const existing = await endorsementFor(
    args.sdk,
    args.registryId,
    args.contractId,
  );
  if (existing?.publisherId === requireId(args.publisherId)) return "unchanged";
  if (existing) {
    await repoint(args, existing, auth);
    return "updated";
  }
  const { Document } = await loadSdkModule();
  const draft = new Document({
    properties: {
      contractId: requireId(args.contractId),
      publisherId: requireId(args.publisherId),
    },
    documentTypeName: ENDORSEMENT_DOCUMENT_TYPE,
    dataContractId: requireId(args.registryId),
    ownerId: identity.id,
  });
  const document = await prepare(
    args.sdk,
    args.registryId,
    ENDORSEMENT_DOCUMENT_TYPE,
    draft,
  );
  try {
    await submit("endorsement", () =>
      args.sdk.documents.create({ document, identityKey, signer }),
    );
    return "created";
  } catch (error) {
    if (!isDuplicate(error)) throw error;
    const committed = await endorsementFor(
      args.sdk,
      args.registryId,
      args.contractId,
    );
    if (!committed)
      throw new Error(
        "This contract already has an endorsement, but it could not be loaded. Refresh and try again.",
      );
    if (committed.publisherId === requireId(args.publisherId))
      return "unchanged";
    await repoint(args, committed, auth);
    return "updated";
  }
}

/** Delete the endorsement; every entry for the contract becomes community. */
export async function withdrawEndorsement(args: {
  sdk: SessionSdk;
  keyManager: DashKeyManager;
  registryId: string;
  endorsement: Endorsement;
}) {
  const { identityKey, signer } = await ownerAuth({
    ...args,
    contractId: args.endorsement.contractId,
  });
  const current = await args.sdk.documents.get(
    args.registryId,
    ENDORSEMENT_DOCUMENT_TYPE,
    args.endorsement.id,
  );
  if (!current) throw new Error("This endorsement no longer exists.");
  await submit("endorsement", () =>
    args.sdk.documents.delete({ document: current, identityKey, signer }),
  );
}
