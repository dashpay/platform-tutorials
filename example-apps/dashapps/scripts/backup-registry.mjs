/**
 * Read-only backup of the dashapps registry.
 *
 * Pages every appMetadata, appEndorsement and appReview document and writes
 * one JSON file holding each document's identity ($id, $ownerId, timestamps,
 * revision) plus its properties, so the registry can be restored or re-seeded
 * after a contract change.
 *
 * Usage:
 *   node scripts/backup-registry.mjs [--network testnet|mainnet]
 *                                    [--contract <id>] [--out <path>]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient } from "../../../setupDashClient-core.mjs";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Normalize an SDK result (Map, array, or record) to an array of documents. */
function rows(result) {
  return result instanceof Map
    ? [...result.values()].filter(Boolean)
    : Array.isArray(result)
      ? result
      : Object.values(result || {}).filter(Boolean);
}

function documentId(doc, protocolVersion) {
  return String(
    doc.id ??
      doc.toJSON?.(protocolVersion)?.$id ??
      doc.toJSON?.(protocolVersion)?.id ??
      "",
  );
}

/** Identifier properties come back as raw 32-byte arrays; render them base58. */
function bytesId(value) {
  if (typeof value === "string") return value;
  if (
    value?.toString &&
    !(value instanceof Uint8Array) &&
    !Array.isArray(value)
  )
    return value.toString();
  const bytes =
    value instanceof Uint8Array ? value : Uint8Array.from(value || []);
  if (bytes.length !== 32)
    throw new Error("Identifier property must contain 32 bytes.");
  let n = 0n;
  for (const byte of bytes) n = n * 256n + BigInt(byte);
  let encoded = "";
  while (n > 0n) {
    encoded = BASE58[Number(n % 58n)] + encoded;
    n /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = `1${encoded}`;
  }
  return encoded;
}

const DOCUMENT_TYPES = ["appMetadata", "appEndorsement", "appReview"];
const IDENTIFIER_PROPERTIES = new Set(["contractId", "publisherId"]);
// Each type is walked along an index covering every document; reviews have no
// $createdAt index, so they walk the unique ($ownerId, contractId) one.
const BACKUP_ORDER = {
  appMetadata: [["$createdAt", "asc"]],
  appEndorsement: [["$createdAt", "asc"]],
  appReview: [["$ownerId", "asc"]],
};
const DEFAULT_CONTRACT_IDS = {
  testnet: "DkpxWsi5D9cP3RvNiF2uMDEhFF3cFCmsVhHXY5HNawkN",
  mainnet: "",
};
const PAGE_SIZE = 100;

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith("--")) throw new Error(`Unexpected argument: ${flag}`);
    const value = argv[i + 1];
    if (value == null || value.startsWith("--"))
      throw new Error(`Missing value for ${flag}`);
    options[flag.slice(2)] = value;
    i += 1;
  }
  return options;
}

const { network = "testnet", contract, out } = parseArgs(process.argv.slice(2));
if (network !== "testnet" && network !== "mainnet")
  throw new Error(`Unknown network: ${network}`);
const contractId = contract || DEFAULT_CONTRACT_IDS[network];
if (!contractId)
  throw new Error(`No registry contract ID configured for ${network}.`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = resolve(out || `backups/dashapps-${network}-${stamp}.json`);

const sdk = await createClient(network);

async function fetchAll(documentTypeName) {
  const entries = [];
  const seen = new Set();
  let startAfter;
  for (;;) {
    const page = rows(
      await sdk.documents.query({
        dataContractId: contractId,
        documentTypeName,
        orderBy: BACKUP_ORDER[documentTypeName],
        limit: PAGE_SIZE,
        ...(startAfter ? { startAfter } : {}),
      }),
    );
    for (const doc of page) {
      const id = documentId(doc, sdk.version());
      if (!id) throw new Error("Registry document has no ID.");
      if (seen.has(id)) throw new Error(`Cyclic pagination result: ${id}`);
      seen.add(id);
      entries.push(doc);
    }
    if (page.length < PAGE_SIZE) return entries;
    const next = documentId(page.at(-1), sdk.version());
    if (!next || next === startAfter)
      throw new Error("Pagination cursor did not advance.");
    startAfter = next;
  }
}

function serialize(doc) {
  const object = doc.toObject?.(sdk.version()) ?? {};
  const properties = doc.properties ?? object;
  const values = {};
  for (const [key, value] of Object.entries(properties)) {
    if (key.startsWith("$")) continue;
    // Identifier properties are 32 bytes; store them as canonical base58.
    values[key] = IDENTIFIER_PROPERTIES.has(key) ? bytesId(value) : value;
  }
  return {
    $id: documentId(doc, sdk.version()),
    $ownerId: bytesId(doc.ownerId ?? object.$ownerId),
    $createdAt: stringOrNull(doc.createdAt ?? object.$createdAt),
    $updatedAt: stringOrNull(doc.updatedAt ?? object.$updatedAt),
    $revision: stringOrNull(doc.revision ?? object.$revision),
    properties: values,
  };
}

function stringOrNull(value) {
  return value == null ? null : String(value);
}

try {
  const documents = {};
  for (const type of DOCUMENT_TYPES)
    documents[type] = (await fetchAll(type)).map(serialize);
  const backup = {
    network,
    contractId,
    protocolVersion: sdk.version(),
    backedUpAt: new Date().toISOString(),
    counts: Object.fromEntries(
      DOCUMENT_TYPES.map((type) => [type, documents[type].length]),
    ),
    documents,
  };
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(backup, null, 2)}\n`);
  console.log(
    `Backed up ${DOCUMENT_TYPES.map((type) => `${backup.counts[type]} ${type}`).join(", ")} documents from ${contractId} (${network}) to ${outPath}`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
