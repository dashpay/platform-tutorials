/**
 * Restore dashapps registry entries from a backup file.
 *
 * Groups the backup by original owner, then works through one identity at a
 * time: it prompts for that owner's credentials (WIF private key or BIP39
 * mnemonic), re-creates every entry that identity submitted, and only then
 * moves on to the next owner. Entries whose owner you skip are left alone.
 *
 * Documents are re-created rather than restored in place — Platform derives
 * a document ID from owner + entropy, so a restored entry gets a new $id and
 * fresh $createdAt/$updatedAt. Ownership and metadata are preserved.
 *
 * WRITES TO THE NETWORK AND SPENDS CREDITS. Use --dry-run to preview.
 *
 * Usage:
 *   node scripts/restore-registry.mjs <backup.json> [--network testnet|mainnet]
 *                                     [--contract <id>] [--only <ownerId,...>]
 *                                     [--dry-run]
 */
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  createClient,
  IdentityKeyManager,
} from "../../../setupDashClient-core.mjs";
// The repo root and this app each install their own copy of @dashevo/evo-sdk,
// and each copy has its own WASM instance. createClient (imported above from
// the root) initializes the ROOT copy, so every SDK class used here must come
// from that same copy — importing "@dashevo/evo-sdk" would resolve to the app's
// uninitialized copy and fail with an undefined document_constructor.
import {
  Document,
  IdentitySigner,
  PlatformVersion,
  PrivateKey,
  Purpose,
  SecurityLevel,
} from "../../../node_modules/@dashevo/evo-sdk/dist/evo-sdk.module.js";

const DOCUMENT_TYPE = "appMetadata";
// Properties the restore replays. $-prefixed system fields are re-derived by
// Platform, and anything outside the contract schema would fail validation.
const METADATA_FIELDS = [
  "contractId",
  "name",
  "description",
  "website",
  "repository",
  "docs",
  "tagline",
  "category",
  "tags",
  "appUrl",
  "iconUrl",
];
const AUTH_LEVELS = new Set([SecurityLevel.HIGH, SecurityLevel.CRITICAL]);

/**
 * SDK errors are WASM objects: `message` can be a method rather than a string,
 * and the payload is sometimes base64. Fall back through each shape so a
 * failure reports something actionable instead of "[object Object]".
 */
function errorText(error) {
  if (error instanceof Error && typeof error.message === "string")
    return error.message;
  let message;
  try {
    message =
      typeof error?.message === "function" ? error.message() : error?.message;
  } catch {
    message = undefined;
  }
  if (typeof message !== "string" || !message) {
    try {
      message = JSON.stringify(error);
    } catch {
      message = undefined;
    }
  }
  message ||= String(error);
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(message) && message.length > 8) {
    try {
      const decoded = Buffer.from(message, "base64")
        .toString("utf8")
        .replace(/[^\x20-\x7E]+/g, " ")
        .trim();
      if (decoded) message = decoded;
    } catch {
      /* keep the original message */
    }
  }
  const code = error?.code ?? error?.errorCode;
  return code == null ? message : `${message} (code ${code})`;
}

function parseArgs(argv) {
  const options = { positional: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith("--")) {
      options.positional.push(flag);
      continue;
    }
    if (flag === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    const value = argv[i + 1];
    if (value == null || value.startsWith("--"))
      throw new Error(`Missing value for ${flag}`);
    options[flag.slice(2)] = value;
    i += 1;
  }
  return options;
}

const args = parseArgs(process.argv.slice(2));
const [backupPath] = args.positional;
if (!backupPath)
  throw new Error(
    "Usage: node scripts/restore-registry.mjs <backup.json> [--network …] [--contract …] [--only …] [--dry-run]",
  );

const backup = JSON.parse(await readFile(backupPath, "utf8"));
if (backup.documentTypeName !== DOCUMENT_TYPE)
  throw new Error(`Backup is not a ${DOCUMENT_TYPE} backup.`);
if (!Array.isArray(backup.entries) || backup.entries.length === 0)
  throw new Error("Backup contains no entries.");

const network = args.network || backup.network || "testnet";
if (network !== "testnet" && network !== "mainnet")
  throw new Error(`Unknown network: ${network}`);
const registryId = args.contract || backup.contractId;
if (!registryId) throw new Error("No target registry contract ID.");
const only = args.only
  ? new Set(
      args.only
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    )
  : null;

/** Group the backup by original owner, preserving backup order within a group. */
function byOwner(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const owner = entry.$ownerId;
    if (!owner) throw new Error(`Backup entry ${entry.$id} has no $ownerId.`);
    if (only && !only.has(owner)) continue;
    if (!groups.has(owner)) groups.set(owner, []);
    groups.get(owner).push(entry);
  }
  return groups;
}

/** Keep only schema properties, dropping empty strings the schema rejects. */
function properties(entry) {
  const source = entry.metadata ?? {};
  const result = {};
  for (const field of METADATA_FIELDS) {
    const value = source[field];
    if (value == null || value === "") continue;
    result[field] = value;
  }
  if (!result.contractId || !result.name || !result.tagline || !result.category)
    throw new Error(
      `Backup entry ${entry.$id} is missing a required field (contractId, name, tagline, category).`,
    );
  return result;
}

/** Does this identity already have an entry for the target contract? */
async function alreadyPresent(sdk, ownerId, targetId) {
  const found = await sdk.documents.query({
    dataContractId: registryId,
    documentTypeName: DOCUMENT_TYPE,
    where: [
      ["$ownerId", "==", ownerId],
      ["contractId", "==", targetId],
    ],
    orderBy: [
      ["$ownerId", "asc"],
      ["contractId", "asc"],
    ],
    limit: 1,
  });
  const rows =
    found instanceof Map ? [...found.values()].filter(Boolean) : found || [];
  return (Array.isArray(rows) ? rows : Object.values(rows)).length > 0;
}

/**
 * Identifier properties must be canonical base58 at the Document boundary; a
 * contract-aware round trip produces the typed identifier before validation.
 * Timestamps are seeded because serialization precedes facade population.
 */
async function prepare(sdk, contract, draft) {
  const now = BigInt(Date.now());
  if (draft.createdAt == null) draft.createdAt = now;
  if (draft.updatedAt == null) draft.updatedAt = now;
  const version = new PlatformVersion(sdk.version());
  const prepared = Document.fromBytes(
    draft.toBytes(contract, version),
    contract,
    DOCUMENT_TYPE,
    version,
  );
  if (draft.entropy) prepared.entropy = draft.entropy;
  return prepared;
}

/** Resolve a WIF to auth material, verifying it belongs to the expected owner. */
async function authFromWif(sdk, wif, ownerId) {
  let privateKey;
  try {
    privateKey = PrivateKey.fromWIF(wif);
  } catch {
    throw new Error("That does not look like a valid WIF private key.");
  }
  const identity = await sdk.identities.fetch(ownerId);
  if (!identity) throw new Error(`Identity ${ownerId} was not found.`);
  const pubKeyHash = Buffer.from(privateKey.getPublicKeyHash()).toString("hex");
  const pubKey = privateKey.getPublicKey?.() ?? privateKey.toPublicKey?.();
  const pubKeyHex = pubKey
    ? Buffer.from(pubKey.toBytes()).toString("hex")
    : null;
  const matched = (identity.toJSON().publicKeys ?? []).find((key) => {
    if (!key.data) return false;
    const hex = /^[0-9a-fA-F]+$/.test(key.data)
      ? key.data.toLowerCase()
      : Buffer.from(key.data, "base64").toString("hex");
    return hex === pubKeyHex?.toLowerCase() || hex === pubKeyHash.toLowerCase();
  });
  if (!matched)
    throw new Error(`That key does not belong to identity ${ownerId}.`);
  if (matched.disabled || matched.disabledAt)
    throw new Error("That key has been disabled on the identity.");
  if (
    matched.purpose !== Purpose.AUTHENTICATION ||
    !AUTH_LEVELS.has(matched.securityLevel)
  )
    throw new Error(
      "That key cannot sign document writes. Use a HIGH or CRITICAL authentication key.",
    );
  const signer = new IdentitySigner();
  signer.addKeyFromWif(wif);
  return {
    identity,
    identityKey: identity.getPublicKeyById(matched.id),
    signer,
  };
}

/**
 * Resolve a mnemonic to auth material for the expected owner.
 *
 * `IdentityKeyManager.create` accepts an `identityId` on faith: it derives keys
 * from the mnemonic and never checks they belong to that identity. Passing the
 * owner ID directly would happily build a signer holding the wrong mnemonic's
 * keys, which only surfaces at broadcast as "No private key found for public
 * key hash". So resolve the identity FROM the mnemonic instead and compare.
 */
async function authFromMnemonic(sdk, mnemonic, ownerId, identityIndex) {
  const manager = await IdentityKeyManager.create({
    sdk,
    mnemonic,
    network,
    identityIndex,
  });
  const resolved = manager.identityId;
  if (resolved !== ownerId)
    throw new Error(
      `That mnemonic (index ${identityIndex}) is identity ${resolved}, not ${ownerId}. Enter the mnemonic that owns these entries, or a different identity index.`,
    );
  const auth = await manager.getAuth();
  if (!auth.identityKey)
    throw new Error(
      `The derived authentication key is not present on identity ${ownerId}.`,
    );
  return auth;
}

const sdk = await createClient(network);
const contract = (await sdk.contracts.getMany([registryId])).get(registryId);
if (!contract)
  throw new Error(
    `Registry contract ${registryId} was not found on ${network}.`,
  );
if (!contract.schemas?.[DOCUMENT_TYPE])
  throw new Error(
    `Contract ${registryId} has no ${DOCUMENT_TYPE} document type.`,
  );

const groups = byOwner(backup.entries);
if (groups.size === 0)
  throw new Error("No entries matched the requested owners.");

const rl = createInterface({ input: stdin, output: stdout });
const summary = [];

console.log(
  `Restoring ${backup.entries.length} entries across ${groups.size} identities into ${registryId} (${network}).`,
);
if (args.dryRun) console.log("Dry run — nothing will be written.\n");

try {
  for (const [ownerId, entries] of groups) {
    console.log(`\n=== Identity ${ownerId} — ${entries.length} entries ===`);
    for (const entry of entries)
      console.log(
        `  • ${entry.metadata?.name} → ${entry.metadata?.contractId}`,
      );

    if (args.dryRun) {
      for (const entry of entries) properties(entry); // validate only
      summary.push({
        ownerId,
        restored: 0,
        skipped: entries.length,
        failed: 0,
      });
      continue;
    }

    // Credentials are read per identity so one owner's key is never in memory
    // while another owner's entries are being written.
    let auth = null;
    while (!auth) {
      const choice = (
        await rl.question("Credentials — [w]IF, [m]nemonic, or [s]kip? ")
      )
        .trim()
        .toLowerCase();
      if (choice === "s" || choice === "skip") break;
      try {
        if (choice === "w" || choice === "wif") {
          const wif = (await rl.question("  WIF private key: ")).trim();
          auth = await authFromWif(sdk, wif, ownerId);
        } else if (choice === "m" || choice === "mnemonic") {
          const mnemonic = (await rl.question("  BIP39 mnemonic: ")).trim();
          const indexInput = (
            await rl.question("  Identity index [0]: ")
          ).trim();
          const identityIndex = indexInput ? Number(indexInput) : 0;
          if (!Number.isSafeInteger(identityIndex) || identityIndex < 0)
            throw new Error("Identity index must be a non-negative integer.");
          auth = await authFromMnemonic(sdk, mnemonic, ownerId, identityIndex);
        } else {
          console.log("  Enter w, m, or s.");
          continue;
        }
      } catch (error) {
        console.error(`  ${errorText(error)}`);
      }
    }

    if (!auth) {
      console.log(`  Skipped ${ownerId}.`);
      summary.push({
        ownerId,
        restored: 0,
        skipped: entries.length,
        failed: 0,
      });
      continue;
    }

    let restored = 0;
    let skipped = 0;
    let failed = 0;
    for (const entry of entries) {
      const label = `${entry.metadata?.name} (${entry.metadata?.contractId})`;
      try {
        const props = properties(entry);
        if (await alreadyPresent(sdk, ownerId, props.contractId)) {
          console.log(`  = ${label} already present; left as is.`);
          skipped++;
          continue;
        }
        const draft = new Document({
          properties: props,
          documentTypeName: DOCUMENT_TYPE,
          dataContractId: registryId,
          ownerId: auth.identity.id,
        });
        const document = await prepare(sdk, contract, draft);
        await sdk.documents.create({
          document,
          identityKey: auth.identityKey,
          signer: auth.signer,
        });
        console.log(`  + ${label} restored.`);
        restored++;
      } catch (error) {
        const text = errorText(error);
        console.error(`  ! ${label} failed: ${text}`);
        failed++;
        // A signing failure is a credential problem, not a per-entry one, so
        // stop rather than repeating the same error for every remaining entry.
        if (text.includes("No private key found")) {
          const remaining = entries.length - restored - skipped - failed;
          console.error(
            `  Stopping this identity: the signer does not hold its keys.${remaining > 0 ? ` ${remaining} entries not attempted.` : ""}`,
          );
          failed += remaining;
          break;
        }
      }
    }
    summary.push({ ownerId, restored, skipped, failed });
  }
} finally {
  rl.close();
}

console.log("\nSummary:");
for (const row of summary)
  console.log(
    `  ${row.ownerId}  restored=${row.restored} skipped=${row.skipped} failed=${row.failed}`,
  );
if (summary.some((row) => row.failed > 0)) process.exitCode = 1;
