/**
 * Read queries over the proof-of-existence contract.
 *
 * Each helper returns a normalized AnchorRecord so UI code never has to care
 * whether the SDK returned an array, map, or plain object.
 *
 * SDK method: sdk.documents.query(...)
 */
import {
  bytesToBase64,
  bytesToHex,
  coerceBytes,
} from "../lib/hash";
import { refreshContractCache } from "./contract";
import type { Logger } from "./logger";
import type {
  DashAnchorQueryDocument,
  DashAnchorQueryJson,
  DashAnchorQueryResults,
  DashSdk,
} from "./types";

const MAX_QUERY_LIMIT = 100;

export interface AnchorRecord {
  id: string;
  ownerId: string;
  createdAt: number | null;
  entryHash: Uint8Array;
  entryHashHex: string;
  chainId: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  note?: string;
  previousId?: Uint8Array;
}

function toTimestamp(value: DashAnchorQueryJson["$createdAt"]): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toAnchor(id: string | null, raw: DashAnchorQueryDocument): AnchorRecord {
  const json: DashAnchorQueryJson =
    typeof raw?.toJSON === "function" ? raw.toJSON() : raw;
  const entryHash = coerceBytes(json.entryHash);
  const previousId = json.previousId ? coerceBytes(json.previousId) : undefined;
  return {
    id: String(id ?? json.$id ?? json.id ?? ""),
    ownerId: String(json.$ownerId ?? ""),
    createdAt: toTimestamp(json.$createdAt),
    entryHash,
    entryHashHex: bytesToHex(entryHash),
    chainId: String(json.chainId ?? ""),
    filename: typeof json.filename === "string" ? json.filename : undefined,
    mimeType: typeof json.mimeType === "string" ? json.mimeType : undefined,
    size: typeof json.size === "number" ? json.size : undefined,
    note: typeof json.note === "string" ? json.note : undefined,
    previousId,
  };
}

export function normalizeAnchors(results: DashAnchorQueryResults): AnchorRecord[] {
  if (Array.isArray(results)) return results.map((doc) => toAnchor(null, doc));
  const entries = results instanceof Map ? Object.fromEntries(results) : results;
  return Object.entries(entries).map(([id, doc]) => toAnchor(id, doc));
}

interface BaseQueryParams {
  sdk: DashSdk;
  contractId: string;
  limit?: number;
  log?: Logger;
}

interface DocumentQuery {
  dataContractId: string;
  documentTypeName: string;
  where?: unknown[][];
  orderBy?: [string, "asc" | "desc"][];
  limit?: number;
}

export async function findAnchorByHash({
  sdk,
  contractId,
  entryHash,
  log,
}: BaseQueryParams & { entryHash: Uint8Array }): Promise<AnchorRecord | null> {
  log?.("Looking up proof by SHA-256 hash…");
  await refreshContractCache({ sdk, contractId });
  const query: DocumentQuery = {
    dataContractId: contractId,
    documentTypeName: "anchor",
    where: [["entryHash", "==", bytesToBase64(entryHash)]],
    orderBy: [["entryHash", "asc"]],
    limit: 1,
  };
  const results = await sdk.documents.query(query);
  const [match] = normalizeAnchors(results);
  log?.(match ? "Matching proof found." : "No matching proof found.");
  return match ?? null;
}

export async function listAnchorsByOwner({
  sdk,
  contractId,
  ownerId,
  limit = MAX_QUERY_LIMIT,
  log,
}: BaseQueryParams & { ownerId: string }): Promise<AnchorRecord[]> {
  log?.("Loading your proof history…");
  await refreshContractCache({ sdk, contractId });
  const query: DocumentQuery = {
    dataContractId: contractId,
    documentTypeName: "anchor",
    where: [["$ownerId", "==", ownerId]],
    orderBy: [
      ["$ownerId", "asc"],
      ["$createdAt", "asc"],
    ],
    limit,
  };
  const results = await sdk.documents.query(query);
  return normalizeAnchors(results).sort(
    (left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0),
  );
}

export async function listAnchorsByChain({
  sdk,
  contractId,
  chainId,
  limit = MAX_QUERY_LIMIT,
  log,
}: BaseQueryParams & { chainId: string }): Promise<AnchorRecord[]> {
  const trimmed = chainId.trim();
  if (!trimmed) return [];
  log?.(`Loading chain history for "${trimmed}"…`);
  await refreshContractCache({ sdk, contractId });
  const query: DocumentQuery = {
    dataContractId: contractId,
    documentTypeName: "anchor",
    where: [["chainId", "==", trimmed]],
    orderBy: [
      ["chainId", "asc"],
      ["$createdAt", "asc"],
    ],
    limit,
  };
  const results = await sdk.documents.query(query);
  return normalizeAnchors(results).sort(
    (left, right) => (left.createdAt ?? 0) - (right.createdAt ?? 0),
  );
}
