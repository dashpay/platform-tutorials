import { requireId } from "./ids";
import type { ReadSdk } from "./types";
import { toDocumentArray, type DocumentHandle } from "../lib/safeDoc";
import { chunks, parseEach, queryPage } from "./paging";
import { publisherEntry, type RegistryEntry } from "./registryReads";

export const ENDORSEMENT_DOCUMENT_TYPE = "appEndorsement";
export const ENDORSEMENT_PAGE_SIZE = 25;

/** A contract owner naming the publisher whose entry is official. */
export interface Endorsement {
  id: string;
  ownerId: string;
  contractId: string;
  publisherId: string;
  createdAt?: bigint;
  updatedAt?: bigint;
  revision: bigint;
}

/**
 * An endorsement and the entry it points at. `entry` is null when the
 * publisher has since withdrawn their entry: the network checks the reference
 * on create and replace, not when the referenced entry is deleted.
 */
export interface OfficialListing {
  endorsement: Endorsement;
  entry: RegistryEntry | null;
}

function bigintField(value: unknown): bigint | undefined {
  if (value == null) return undefined;
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    throw new Error("Malformed endorsement timestamp or revision.");
  }
}

export function endorsementRecord(document: DocumentHandle): Endorsement {
  const source = document as DocumentHandle & {
    createdAt?: unknown;
    updatedAt?: unknown;
    revision?: unknown;
    toObject?: () => Record<string, unknown>;
  };
  const object = source.toObject?.() ?? {};
  const properties = source.properties ?? object;
  return {
    id: requireId(source.id ?? object.$id),
    ownerId: requireId(source.ownerId ?? object.$ownerId),
    contractId: requireId(properties.contractId),
    publisherId: requireId(properties.publisherId),
    createdAt: bigintField(source.createdAt ?? object.$createdAt),
    updatedAt: bigintField(source.updatedAt ?? object.$updatedAt),
    revision: bigintField(source.revision ?? object.$revision) ?? 1n,
  };
}

export async function endorsementFor(
  sdk: ReadSdk,
  registryId: string,
  contractId: string,
): Promise<Endorsement | null> {
  const documents = toDocumentArray(
    await sdk.documents.query({
      dataContractId: requireId(registryId),
      documentTypeName: ENDORSEMENT_DOCUMENT_TYPE,
      where: [["contractId", "==", requireId(contractId)]],
      orderBy: [["contractId", "asc"]],
      limit: 1,
    }),
  );
  return parseEach(documents, endorsementRecord)[0] ?? null;
}

/** The endorsements for a page of contracts, keyed by contract ID. */
export async function endorsementsFor(
  sdk: ReadSdk,
  registryId: string,
  contractIds: string[],
): Promise<Map<string, Endorsement>> {
  const ids = [...new Set(contractIds.map((value) => requireId(value)))];
  const endorsements = new Map<string, Endorsement>();
  for (const chunk of chunks(ids)) {
    const documents = toDocumentArray(
      await sdk.documents.query({
        dataContractId: requireId(registryId),
        documentTypeName: ENDORSEMENT_DOCUMENT_TYPE,
        where: [["contractId", "in", chunk]],
        orderBy: [["contractId", "asc"]],
        limit: chunk.length,
      }),
    );
    for (const endorsement of parseEach(documents, endorsementRecord))
      endorsements.set(endorsement.contractId, endorsement);
  }
  return endorsements;
}

export function officialListingOf(
  sdk: ReadSdk,
  registryId: string,
  endorsement: Endorsement,
): Promise<OfficialListing> {
  return publisherEntry(
    sdk,
    registryId,
    endorsement.publisherId,
    endorsement.contractId,
  ).then((entry) => ({ endorsement, entry }));
}

/** The official entry for a contract, or null when it has no endorsement. */
export async function officialListing(
  sdk: ReadSdk,
  registryId: string,
  contractId: string,
): Promise<OfficialListing | null> {
  const endorsement = await endorsementFor(sdk, registryId, contractId);
  return endorsement ? officialListingOf(sdk, registryId, endorsement) : null;
}

/** Endorsed contracts, newest endorsement first, with their official entries. */
export async function officialFeed(
  sdk: ReadSdk,
  registryId: string,
  cursor?: string,
  limit = ENDORSEMENT_PAGE_SIZE,
): Promise<{ listings: OfficialListing[]; cursor?: string }> {
  const page = await queryPage(
    sdk,
    {
      dataContractId: requireId(registryId),
      documentTypeName: ENDORSEMENT_DOCUMENT_TYPE,
      where: [],
      orderBy: [["$createdAt", "desc"]],
    },
    endorsementRecord,
    limit,
    cursor,
  );
  const listings = await Promise.all(
    page.items.map((endorsement) =>
      officialListingOf(sdk, registryId, endorsement),
    ),
  );
  return { listings, cursor: page.cursor };
}

/** The endorsements an identity has written, most recently updated first. */
export async function myEndorsements(
  sdk: ReadSdk,
  registryId: string,
  ownerId: string,
  cursor?: string,
  limit = ENDORSEMENT_PAGE_SIZE,
): Promise<{ endorsements: Endorsement[]; cursor?: string }> {
  const page = await queryPage(
    sdk,
    {
      dataContractId: requireId(registryId),
      documentTypeName: ENDORSEMENT_DOCUMENT_TYPE,
      where: [["$ownerId", "==", requireId(ownerId)]],
      orderBy: [["$updatedAt", "desc"]],
    },
    endorsementRecord,
    limit,
    cursor,
  );
  return { endorsements: page.items, cursor: page.cursor };
}

/**
 * One row per contract, in first-seen order, preferring the official entry.
 * `officialPublishers` maps contract ID → endorsed publisher ID.
 */
export function collapseByContract(
  entries: RegistryEntry[],
  officialPublishers: ReadonlyMap<string, string>,
) {
  const byContract = new Map<string, RegistryEntry>();
  for (const entry of entries) {
    const current = byContract.get(entry.contractId);
    const official = officialPublishers.get(entry.contractId);
    if (
      !current ||
      (entry.ownerId === official && current.ownerId !== official)
    )
      byContract.set(entry.contractId, entry);
  }
  return [...byContract.values()];
}
