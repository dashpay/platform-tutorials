import { requireId } from "./ids";
import type { ReadSdk } from "./types";
import { toDocumentArray, type DocumentHandle } from "../lib/safeDoc";

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

export async function entriesByCategory(
  sdk: ReadSdk,
  registryId: string,
  category: AppCategory,
  cursor?: string,
) {
  const page = await query(sdk, {
    dataContractId: requireId(registryId),
    documentTypeName: REGISTRY_DOCUMENT_TYPE,
    where: [["category", "==", category]],
    orderBy: [
      ["category", "asc"],
      ["$createdAt", "asc"],
    ],
    limit: 25,
    ...(cursor ? { startAfter: requireId(cursor) } : {}),
  });
  const next = page.rowCount === 25 ? page.lastId : undefined;
  if (next && next === cursor)
    throw new Error("Category pagination cursor did not advance.");
  return { entries: page.entries.reverse(), cursor: next };
}

async function query(
  sdk: ReadSdk,
  args: Parameters<ReadSdk["documents"]["query"]>[0],
) {
  const documents = toDocumentArray(await sdk.documents.query(args));
  const entries = documents.flatMap((document) => {
    try {
      return [registryEntry(document)];
    } catch {
      return [];
    }
  });
  const last = documents.at(-1);
  const lastObject =
    (
      last as DocumentHandle & {
        toObject?: () => Record<string, unknown>;
      }
    )?.toObject?.() ?? {};
  return {
    entries,
    rowCount: documents.length,
    lastId: last ? requireId(last.id ?? lastObject.$id) : undefined,
  };
}

export async function exactRegistryEntry(
  sdk: ReadSdk,
  registryId: string,
  ownerId: string,
  contractId: string,
) {
  const { entries } = await query(sdk, {
    dataContractId: requireId(registryId),
    documentTypeName: REGISTRY_DOCUMENT_TYPE,
    where: [
      ["$ownerId", "==", requireId(ownerId)],
      ["contractId", "==", requireId(contractId)],
    ],
    orderBy: [
      ["$ownerId", "asc"],
      ["contractId", "asc"],
    ],
    limit: 1,
  });
  return entries[0] ?? null;
}

export async function allProposals(
  sdk: ReadSdk,
  registryId: string,
  contractId: string,
) {
  const entries: RegistryEntry[] = [];
  const ids = new Set<string>();
  let startAfter: string | undefined;
  for (;;) {
    const page = await query(sdk, {
      dataContractId: requireId(registryId),
      documentTypeName: REGISTRY_DOCUMENT_TYPE,
      where: [["contractId", "==", requireId(contractId)]],
      orderBy: [
        ["contractId", "asc"],
        ["$createdAt", "asc"],
      ],
      limit: 100,
      ...(startAfter ? { startAfter } : {}),
    });
    for (const entry of page.entries) {
      if (ids.has(entry.id))
        throw new Error("Proposal pagination returned a duplicate document.");
      ids.add(entry.id);
      entries.push(entry);
      if (entries.length > 2_000)
        throw new Error(
          "Proposal scan exceeded the 2,000-document safety limit.",
        );
    }
    if (page.rowCount < 100) return entries.reverse();
    const next = page.lastId!;
    if (next === startAfter)
      throw new Error("Proposal pagination cursor did not advance.");
    startAfter = next;
  }
}

export async function recentEntries(
  sdk: ReadSdk,
  registryId: string,
  cursor?: string,
) {
  const page = await query(sdk, {
    dataContractId: requireId(registryId),
    documentTypeName: REGISTRY_DOCUMENT_TYPE,
    where: [],
    orderBy: [["$createdAt", "desc"]],
    limit: 50,
    ...(cursor ? { startAfter: requireId(cursor) } : {}),
  });
  const next = page.rowCount === 50 ? page.lastId : undefined;
  if (next && next === cursor)
    throw new Error("Recent pagination cursor did not advance.");
  return { entries: page.entries, cursor: next };
}

export async function searchEntriesByName(
  sdk: ReadSdk,
  registryId: string,
  value: string,
  cursor?: string,
) {
  const prefix = value.trim();
  if (!prefix || prefix.length > 63)
    throw new Error("Use a name prefix of 1–63 characters.");
  const page = await query(sdk, {
    dataContractId: requireId(registryId),
    documentTypeName: REGISTRY_DOCUMENT_TYPE,
    where: [["name", "startsWith", prefix]],
    orderBy: [["name", "asc"]],
    limit: 25,
    ...(cursor ? { startAfter: requireId(cursor) } : {}),
  });
  const next = page.rowCount === 25 ? page.lastId : undefined;
  if (next && next === cursor)
    throw new Error("Name pagination cursor did not advance.");
  return { entries: page.entries, cursor: next };
}

export async function myEntries(
  sdk: ReadSdk,
  registryId: string,
  ownerId: string,
) {
  const entries: RegistryEntry[] = [];
  let startAfter: string | undefined;
  const seen = new Set<string>();
  for (;;) {
    const page = await query(sdk, {
      dataContractId: requireId(registryId),
      documentTypeName: REGISTRY_DOCUMENT_TYPE,
      where: [["$ownerId", "==", requireId(ownerId)]],
      orderBy: [
        ["$ownerId", "asc"],
        ["contractId", "asc"],
      ],
      limit: 100,
      ...(startAfter ? { startAfter } : {}),
    });
    for (const entry of page.entries) {
      if (seen.has(entry.id))
        throw new Error(
          "My submissions pagination returned a duplicate document.",
        );
      seen.add(entry.id);
      entries.push(entry);
    }
    if (page.rowCount < 100) return entries;
    const next = page.lastId!;
    if (next === startAfter)
      throw new Error("My submissions cursor did not advance.");
    startAfter = next;
  }
}
