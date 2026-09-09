/**
 * Read-only backup of the dashapps registry.
 *
 * Pages the whole appMetadata collection and writes one JSON file holding each
 * document's identity ($id, $ownerId, timestamps, revision) plus its metadata
 * properties, so listings can be restored or re-seeded after a contract change.
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

const DOCUMENT_TYPE = "appMetadata";
const DEFAULT_CONTRACT_IDS = {
  testnet: "EoMc3L6KsLBr9aTSbBwuZKcVFRnarMfxFMQFXCGY5ZGo",
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

// $createdAt is the only ordering shared by every entry, so pagination walks
// the "recent" index and uses the last document ID as the cursor.
async function fetchAll() {
  const entries = [];
  const seen = new Set();
  let startAfter;
  for (;;) {
    const page = rows(
      await sdk.documents.query({
        dataContractId: contractId,
        documentTypeName: DOCUMENT_TYPE,
        orderBy: [["$createdAt", "asc"]],
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
  const metadata = {};
  for (const [key, value] of Object.entries(properties)) {
    if (key.startsWith("$")) continue;
    // contractId is a 32-byte identifier; store it as canonical base58.
    metadata[key] = key === "contractId" ? bytesId(value) : value;
  }
  return {
    $id: documentId(doc, sdk.version()),
    $ownerId: bytesId(doc.ownerId ?? object.$ownerId),
    $createdAt: stringOrNull(doc.createdAt ?? object.$createdAt),
    $updatedAt: stringOrNull(doc.updatedAt ?? object.$updatedAt),
    $revision: stringOrNull(doc.revision ?? object.$revision),
    metadata,
  };
}

function stringOrNull(value) {
  return value == null ? null : String(value);
}

try {
  const documents = await fetchAll();
  const backup = {
    network,
    contractId,
    documentTypeName: DOCUMENT_TYPE,
    protocolVersion: sdk.version(),
    backedUpAt: new Date().toISOString(),
    count: documents.length,
    entries: documents.map(serialize),
  };
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(backup, null, 2)}\n`);
  console.log(
    `Backed up ${backup.count} ${DOCUMENT_TYPE} documents from ${contractId} (${network}) to ${outPath}`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
