import { requireId } from "./ids";
import type { ReadSdk } from "./types";
import { toDocumentArray, type DocumentHandle } from "../lib/safeDoc";
import { chunks, parseEach, queryPage } from "./paging";

export const REGISTRY_DOCUMENT_TYPE = "appMetadata";
export const APP_CATEGORIES = [
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
] as const;
export type AppCategory = (typeof APP_CATEGORIES)[number];
export interface RegistryEntry {
  id: string;
  ownerId: string;
  contractId: string;
  name: string;
  tagline: string;
  category: AppCategory;
  tags: string[];
  appUrl?: string;
  iconUrl?: string;
  description?: string;
  website?: string;
  repository?: string;
  docs?: string;
  createdAt?: bigint;
  updatedAt?: bigint;
  revision: bigint;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value)
    throw new Error(`Malformed registry ${field}.`);
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string")
    throw new Error(`Malformed registry ${field}.`);
  return value;
}

function bigintField(value: unknown): bigint | undefined {
  if (value == null) return undefined;
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    throw new Error("Malformed registry timestamp or revision.");
  }
}

export function registryEntry(document: DocumentHandle): RegistryEntry {
  const source = document as DocumentHandle & {
    createdAt?: unknown;
    revision?: unknown;
    toObject?: () => Record<string, unknown>;
  };
  const object = source.toObject?.() ?? {};
  const properties = source.properties ?? object;
  const name = requiredString(properties.name, "name");
  const category = requiredString(properties.category, "category");
  if (!APP_CATEGORIES.includes(category as AppCategory))
    throw new Error("Malformed registry category.");
  const tagsValue = properties.tags ?? "";
  if (typeof tagsValue !== "string")
    throw new Error("Malformed registry tags.");
  const tags = tagsValue ? tagsValue.split(",") : [];
  return {
    id: requireId(source.id ?? object.$id),
    ownerId: requireId(source.ownerId ?? object.$ownerId),
    contractId: requireId(properties.contractId),
    name,
    tagline: requiredString(properties.tagline, "tagline"),
    category: category as AppCategory,
    tags,
    appUrl: optionalString(properties.appUrl, "appUrl"),
    iconUrl: optionalString(properties.iconUrl, "iconUrl"),
    description: optionalString(properties.description, "description"),
    website: optionalString(properties.website, "website"),
    repository: optionalString(properties.repository, "repository"),
    docs: optionalString(properties.docs, "docs"),
    createdAt: bigintField(source.createdAt ?? object.$createdAt),
    updatedAt: bigintField(
      (source as { updatedAt?: unknown }).updatedAt ?? object.$updatedAt,
    ),
    revision: bigintField(source.revision ?? object.$revision) ?? 1n,
  };
}

export const CATEGORY_PAGE_SIZE = 25;
export const RECENT_PAGE_SIZE = 50;
export const ENTRY_PAGE_SIZE = 25;

export interface EntryPage {
  entries: RegistryEntry[];
  cursor?: string;
}

async function page(
  sdk: ReadSdk,
  args: Parameters<typeof queryPage>[1],
  limit: number,
  cursor?: string,
): Promise<EntryPage> {
  const { items, cursor: next } = await queryPage(
    sdk,
    args,
    registryEntry,
    limit,
    cursor,
  );
  return { entries: items, cursor: next };
}

export function entriesByCategory(
  sdk: ReadSdk,
  registryId: string,
  category: AppCategory,
  cursor?: string,
  limit = CATEGORY_PAGE_SIZE,
) {
  return page(
    sdk,
    {
      dataContractId: requireId(registryId),
      documentTypeName: REGISTRY_DOCUMENT_TYPE,
      where: [["category", "==", category]],
      orderBy: [["$createdAt", "desc"]],
    },
    limit,
    cursor,
  );
}

export function recentEntries(
  sdk: ReadSdk,
  registryId: string,
  cursor?: string,
  limit = RECENT_PAGE_SIZE,
) {
  return page(
    sdk,
    {
      dataContractId: requireId(registryId),
      documentTypeName: REGISTRY_DOCUMENT_TYPE,
      where: [],
      orderBy: [["$createdAt", "desc"]],
    },
    limit,
    cursor,
  );
}

export function searchEntriesByName(
  sdk: ReadSdk,
  registryId: string,
  value: string,
  cursor?: string,
  limit = ENTRY_PAGE_SIZE,
) {
  const prefix = value.trim();
  if (!prefix || prefix.length > 63)
    throw new Error("Use a name prefix of 1–63 characters.");
  return page(
    sdk,
    {
      dataContractId: requireId(registryId),
      documentTypeName: REGISTRY_DOCUMENT_TYPE,
      where: [["name", "startsWith", prefix]],
      orderBy: [["name", "asc"]],
    },
    limit,
    cursor,
  );
}

/** An identity's entries, most recently updated first. */
export function myEntries(
  sdk: ReadSdk,
  registryId: string,
  ownerId: string,
  cursor?: string,
  limit = RECENT_PAGE_SIZE,
) {
  return page(
    sdk,
    {
      dataContractId: requireId(registryId),
      documentTypeName: REGISTRY_DOCUMENT_TYPE,
      where: [["$ownerId", "==", requireId(ownerId)]],
      orderBy: [["$updatedAt", "desc"]],
    },
    limit,
    cursor,
  );
}

/** Every entry describing one contract, most recently updated first. */
export function contractEntries(
  sdk: ReadSdk,
  registryId: string,
  contractId: string,
  cursor?: string,
  limit = ENTRY_PAGE_SIZE,
) {
  return page(
    sdk,
    {
      dataContractId: requireId(registryId),
      documentTypeName: REGISTRY_DOCUMENT_TYPE,
      where: [["contractId", "==", requireId(contractId)]],
      orderBy: [["$updatedAt", "desc"]],
    },
    limit,
    cursor,
  );
}

/** A contract with no entries comes back as an empty map, not a zero. */
export async function contractEntryCount(
  sdk: ReadSdk,
  registryId: string,
  contractId: string,
): Promise<bigint> {
  const counts = await sdk.documents.count({
    dataContractId: requireId(registryId),
    documentTypeName: REGISTRY_DOCUMENT_TYPE,
    where: [["contractId", "==", requireId(contractId)]],
  });
  if (!(counts instanceof Map) || counts.size > 1)
    throw new Error("Malformed count response.");
  const value = counts.size ? counts.get("") : 0n;
  if (typeof value !== "bigint" || value < 0n)
    throw new Error("Malformed count response.");
  return value;
}

/** The entry one identity published for one contract, if any. */
export async function publisherEntry(
  sdk: ReadSdk,
  registryId: string,
  publisherId: string,
  contractId: string,
): Promise<RegistryEntry | null> {
  const documents = toDocumentArray(
    await sdk.documents.query({
      dataContractId: requireId(registryId),
      documentTypeName: REGISTRY_DOCUMENT_TYPE,
      where: [
        ["$ownerId", "==", requireId(publisherId)],
        ["contractId", "==", requireId(contractId)],
      ],
      orderBy: [
        ["$ownerId", "asc"],
        ["contractId", "asc"],
      ],
      limit: 1,
    }),
  );
  return parseEach(documents, registryEntry)[0] ?? null;
}

/** One identity's entries for a set of contracts, keyed by contract ID. */
export async function publisherEntriesFor(
  sdk: ReadSdk,
  registryId: string,
  publisherId: string,
  contractIds: string[],
) {
  const ids = [...new Set(contractIds.map((value) => requireId(value)))];
  const entries = new Map<string, RegistryEntry>();
  for (const chunk of chunks(ids)) {
    const documents = toDocumentArray(
      await sdk.documents.query({
        dataContractId: requireId(registryId),
        documentTypeName: REGISTRY_DOCUMENT_TYPE,
        where: [
          ["$ownerId", "==", requireId(publisherId)],
          ["contractId", "in", chunk],
        ],
        orderBy: [["contractId", "asc"]],
        limit: chunk.length,
      }),
    );
    for (const entry of parseEach(documents, registryEntry))
      entries.set(entry.contractId, entry);
  }
  return entries;
}
