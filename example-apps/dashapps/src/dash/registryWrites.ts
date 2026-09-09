import type { DashKeyManager } from "./types";
import type { SessionSdk } from "../session/types";
import { requireId } from "./ids";
import {
  APP_CATEGORIES,
  exactRegistryEntry,
  REGISTRY_DOCUMENT_TYPE,
  type AppCategory,
  type RegistryEntry,
} from "./registryReads";
import { loadSdkModule } from "./sdkModule";
import { freshTarget, isDuplicate, prepare } from "./documentWrites";
import { normalizeUrl } from "../lib/urls";
import { SYSTEM_CONTRACT_METADATA } from "./systemContractMetadata";

export interface MetadataInput {
  name: string;
  tagline: string;
  category: AppCategory;
  tags: string;
  appUrl: string;
  iconUrl: string;
  description: string;
  website: string;
  repository: string;
  docs: string;
}

export function metadataProperties(targetId: string, input: MetadataInput) {
  const name = input.name.trim();
  const description = input.description.trim();
  const tagline = input.tagline.trim();
  const tags = [
    ...new Set(
      input.tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (!name || name.length > 63)
    throw new Error("Name must contain 1–63 characters.");
  if (description.length > 1_000)
    throw new Error("Description must be at most 1,000 characters.");
  if (!tagline || tagline.length > 120)
    throw new Error("Tagline must contain 1–120 characters.");
  if (!APP_CATEGORIES.includes(input.category))
    throw new Error("Choose a valid app category.");
  if (
    tags.length > 5 ||
    tags.some(
      (tag) => tag.length > 32 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag),
    )
  )
    throw new Error("Use up to 5 comma-separated lowercase tags.");
  const appUrl = normalizeUrl(input.appUrl);
  const iconUrl = normalizeUrl(input.iconUrl);
  if (iconUrl && !iconUrl.startsWith("https://"))
    throw new Error("Icon URL must use HTTPS.");
  return {
    contractId: requireId(targetId),
    name,
    tagline,
    category: input.category,
    ...(tags.length ? { tags: tags.join(",") } : {}),
    ...(appUrl ? { appUrl } : {}),
    ...(iconUrl ? { iconUrl } : {}),
    ...(description ? { description } : {}),
    ...(normalizeUrl(input.website)
      ? { website: normalizeUrl(input.website) }
      : {}),
    ...(normalizeUrl(input.repository)
      ? { repository: normalizeUrl(input.repository) }
      : {}),
    ...(normalizeUrl(input.docs) ? { docs: normalizeUrl(input.docs) } : {}),
  };
}

export async function createMetadata(args: {
  sdk: SessionSdk;
  keyManager: DashKeyManager;
  registryId: string;
  targetId: string;
  input: MetadataInput;
}) {
  await freshTarget(args.sdk, args.targetId);
  const { identity, identityKey, signer } = await args.keyManager.getAuth();
  if (!identityKey)
    throw new Error(
      "The identity has no usable authentication key for metadata writes.",
    );
  const ownerId = identity.id.toString();
  if (
    await exactRegistryEntry(args.sdk, args.registryId, ownerId, args.targetId)
  )
    throw new Error(
      "You already submitted metadata for this contract. Edit your existing entry.",
    );
  const { Document } = await loadSdkModule();
  const draft = new Document({
    properties: metadataProperties(args.targetId, args.input),
    documentTypeName: REGISTRY_DOCUMENT_TYPE,
    dataContractId: requireId(args.registryId),
    ownerId: identity.id,
  });
  const document = await prepare(
    args.sdk,
    args.registryId,
    REGISTRY_DOCUMENT_TYPE,
    draft,
  );
  try {
    await args.sdk.documents.create({ document, identityKey, signer });
  } catch (error) {
    if (isDuplicate(error))
      throw new Error(
        "You already submitted metadata for this contract. Edit your existing entry.",
      );
    throw error;
  }
}

export async function seedSystemContractMetadata(args: {
  sdk: SessionSdk;
  keyManager: DashKeyManager;
  registryId: string;
}) {
  const failures: Array<{ name: string; error: unknown }> = [];
  let seeded = 0;
  for (const entry of SYSTEM_CONTRACT_METADATA) {
    try {
      await createMetadata({
        ...args,
        targetId: entry.contractId,
        input: entry.input,
      });
      seeded++;
    } catch (error) {
      failures.push({ name: entry.input.name, error });
    }
  }
  return { seeded, failures };
}

export async function editMetadata(args: {
  sdk: SessionSdk;
  keyManager: DashKeyManager;
  registryId: string;
  targetId: string;
  entry: RegistryEntry;
  input: MetadataInput;
}) {
  await freshTarget(args.sdk, args.targetId);
  const { identity, identityKey, signer } = await args.keyManager.getAuth();
  if (!identityKey)
    throw new Error(
      "The identity has no usable authentication key for metadata writes.",
    );
  if (identity.id.toString() !== args.entry.ownerId)
    throw new Error("Only the submission owner can edit this entry.");
  const current = await args.sdk.documents.get(
    args.registryId,
    REGISTRY_DOCUMENT_TYPE,
    args.entry.id,
  );
  if (!current)
    throw new Error(
      "This metadata entry no longer exists. Refresh and try again.",
    );
  const { Document } = await loadSdkModule();
  const draft = new Document({
    properties: metadataProperties(args.targetId, args.input),
    documentTypeName: REGISTRY_DOCUMENT_TYPE,
    dataContractId: args.registryId,
    ownerId: identity.id,
    id: args.entry.id,
    revision: BigInt(current.revision ?? 0) + 1n,
  });
  draft.createdAt = current.createdAt;
  draft.updatedAt = BigInt(Date.now());
  const document = await prepare(
    args.sdk,
    args.registryId,
    REGISTRY_DOCUMENT_TYPE,
    draft,
  );
  await args.sdk.documents.replace({ document, identityKey, signer });
}

export async function withdrawMetadata(args: {
  sdk: SessionSdk;
  keyManager: DashKeyManager;
  registryId: string;
  targetId: string;
  entry: RegistryEntry;
}) {
  await freshTarget(args.sdk, args.targetId);
  const { identity, identityKey, signer } = await args.keyManager.getAuth();
  if (!identityKey)
    throw new Error(
      "The identity has no usable authentication key for metadata writes.",
    );
  if (identity.id.toString() !== args.entry.ownerId)
    throw new Error("Only the submission owner can withdraw this entry.");
  const current = await args.sdk.documents.get(
    args.registryId,
    REGISTRY_DOCUMENT_TYPE,
    args.entry.id,
  );
  if (!current) throw new Error("This metadata entry no longer exists.");
  await args.sdk.documents.delete({ document: current, identityKey, signer });
}
