import assert from "node:assert/strict";
import {
  DataContract,
  Document,
  PlatformVersion,
} from "../../../../node_modules/@dashevo/evo-sdk/dist/evo-sdk.module.js";
import {
  createClient,
  IdentityKeyManager,
} from "../../../../setupDashClient-core.mjs";
import {
  APP_METADATA_SCHEMAS,
  CONTRACT_CONFIG,
  DOCUMENT_TYPE,
  RATING_DOCUMENT_TYPE,
} from "./candidate.mjs";

export function requireOptIn() {
  assert.equal(
    process.env.DASHAPPS_PROBE_SPEND,
    "yes",
    "Set DASHAPPS_PROBE_SPEND=yes to acknowledge testnet credit spending",
  );
  assert(
    process.env.DASHAPPS_PROBE_MNEMONIC?.trim(),
    "Set DASHAPPS_PROBE_MNEMONIC",
  );
  const indices = (process.env.DASHAPPS_PROBE_IDENTITY_INDICES || "0,1")
    .split(",")
    .map(Number);
  assert(
    indices.length === 2 &&
      indices.every(Number.isSafeInteger) &&
      indices[0] !== indices[1],
    "DASHAPPS_PROBE_IDENTITY_INDICES must contain two distinct integers",
  );
  const identityIds = (process.env.DASHAPPS_PROBE_IDENTITY_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  assert(
    identityIds.length === 0 || identityIds.length === 2,
    "DASHAPPS_PROBE_IDENTITY_IDS must be empty or contain two IDs matching the configured indices",
  );
  return {
    mnemonic: process.env.DASHAPPS_PROBE_MNEMONIC.trim(),
    indices,
    identityIds,
  };
}

export async function connectActors() {
  const { mnemonic, indices, identityIds } = requireOptIn();
  const sdk = await createClient("testnet");
  const actors = [];
  for (const [position, identityIndex] of indices.entries()) {
    let manager;
    try {
      manager = await IdentityKeyManager.create({
        sdk,
        mnemonic,
        network: "testnet",
        identityIndex,
        ...(identityIds[position] ? { identityId: identityIds[position] } : {}),
      });
    } catch (error) {
      throw new Error(
        `Could not resolve testnet identityIndex=${identityIndex}${identityIds[position] ? ` as ${identityIds[position]}` : " by master-key hash"}: ${error?.message || String(error)}`,
        { cause: error },
      );
    }
    const auth = await manager.getAuth();
    const identityId = auth.identity.id.toString();
    assert(
      auth.identityKey,
      `Derived authentication key is not present on identity ${identityId} at identityIndex=${identityIndex}`,
    );
    if (identityIds[position])
      assert.equal(
        identityId,
        identityIds[position],
        `Fetched identity does not match DASHAPPS_PROBE_IDENTITY_IDS position ${position}`,
      );
    const balance = await sdk.identities.balance(identityId);
    assert(BigInt(balance) > 0n, `Identity ${identityId} has no credits`);
    actors.push({
      identityIndex,
      manager,
      auth,
      identityId,
      balance: BigInt(balance),
    });
  }
  return { sdk, actors };
}

export async function newCandidate(sdk, actor) {
  const nonce = await sdk.identities.nonce(actor.identityId);
  const contract = new DataContract({
    ownerId: actor.auth.identity.id,
    identityNonce: (nonce || 0n) + 1n,
    schemas: APP_METADATA_SCHEMAS,
    fullValidation: true,
  });
  contract.setConfig(CONTRACT_CONFIG);
  return contract;
}

export function assertCandidate(contract) {
  assert(contract, "Registry contract was not found");
  const schema = contract.schemas?.[DOCUMENT_TYPE];
  assert(schema, `Contract has no ${DOCUMENT_TYPE} document type`);
  for (const field of ["tagline", "category", "tags", "appUrl", "iconUrl"])
    assert(
      schema.properties?.[field],
      `Contract is missing required field ${field}`,
    );
  assert(
    schema.indices?.some((index) => index.name === "byCategoryCreated"),
    "Contract is missing the category index",
  );
  const rating = contract.schemas?.[RATING_DOCUMENT_TYPE];
  assert(rating, `Contract has no ${RATING_DOCUMENT_TYPE} document type`);
  assert(
    rating.indices?.some(
      (index) => index.name === "byContractStars" && index.rangeCountable,
    ),
    "Contract is missing the range-countable stars index",
  );
}

export async function publish(sdk, actor, contract) {
  const published = await sdk.contracts.publish({
    dataContract: contract,
    identityKey: actor.auth.identityKey,
    signer: actor.auth.signer,
  });
  const id = published.id?.toString() || published.toJSON?.(sdk.version())?.id;
  assert(id, "Contract publication returned no ID");
  return { id, published };
}

export function idBytes(value) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const char of value) {
    const digit = alphabet.indexOf(char);
    assert(digit >= 0, `Invalid base58 identifier: ${value}`);
    n = n * 58n + BigInt(digit);
  }
  const bytes = [];
  while (n > 0n) {
    bytes.push(Number(n & 255n));
    n >>= 8n;
  }
  for (const char of value) {
    if (char !== "1") break;
    bytes.push(0);
  }
  bytes.reverse();
  assert.equal(
    bytes.length,
    32,
    `Identifier must decode to 32 bytes: ${value}`,
  );
  return new Uint8Array(bytes);
}

export function bytesId(value) {
  if (typeof value === "string") return value;
  if (
    value?.toString &&
    !(value instanceof Uint8Array) &&
    !Array.isArray(value)
  )
    return value.toString();
  const bytes =
    value instanceof Uint8Array ? value : Uint8Array.from(value || []);
  assert.equal(bytes.length, 32, "Identifier property must contain 32 bytes");
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const byte of bytes) n = n * 256n + BigInt(byte);
  let encoded = "";
  while (n > 0n) {
    encoded = alphabet[Number(n % 58n)] + encoded;
    n /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = `1${encoded}`;
  }
  return encoded;
}

export async function createEntry(sdk, actor, contractId, targetId, name) {
  // Identifier-media properties use canonical base58 at the Document boundary.
  // The contract-aware serializer converts this to Platform Value::Identifier.
  idBytes(targetId); // strict 32-byte validation before handing it to the SDK
  const draft = new Document({
    properties: {
      contractId: targetId,
      name,
      tagline: `Test listing for ${name}`,
      category: "developer-tools",
      tags: "registry-probe",
      appUrl: "https://example.com/app",
      iconUrl: "https://example.com/icon.png",
    },
    documentTypeName: DOCUMENT_TYPE,
    dataContractId: contractId,
    ownerId: actor.auth.identity.id,
  });
  const document = await prepareDocument(sdk, draft, contractId);
  await sdk.documents.create({
    document,
    identityKey: actor.auth.identityKey,
    signer: actor.auth.signer,
  });
  return document;
}

export async function exactEntry(sdk, actor, contractId, targetId) {
  const result = rows(
    await sdk.documents.query({
      dataContractId: contractId,
      documentTypeName: DOCUMENT_TYPE,
      where: [
        ["$ownerId", "==", actor.identityId],
        ["contractId", "==", targetId],
      ],
      orderBy: [
        ["$ownerId", "asc"],
        ["contractId", "asc"],
      ],
      limit: 1,
    }),
  );
  return result[0];
}

export async function ensureEntry(sdk, actor, contractId, targetId, name) {
  const existing = await exactEntry(sdk, actor, contractId, targetId);
  if (existing) return existing;
  try {
    await createEntry(sdk, actor, contractId, targetId, name);
  } catch (error) {
    const committed = await exactEntry(sdk, actor, contractId, targetId);
    if (!committed) throw error;
    return committed;
  }
  const committed = await exactEntry(sdk, actor, contractId, targetId);
  assert(
    committed,
    `Created ${actor.identityId}/${targetId} entry was not readable after confirmation`,
  );
  return committed;
}

export async function prepareDocument(sdk, document, contractId) {
  const contract = (await sdk.contracts.getMany([contractId])).get(contractId);
  assert(contract, `Data contract ${contractId} was not found`);
  const now = BigInt(Date.now());
  if (document.createdAt == null) document.createdAt = now;
  if (document.updatedAt == null) document.updatedAt = now;
  const version = new PlatformVersion(sdk.version());
  const bytes = document.toBytes(contract, version);
  const prepared = Document.fromBytes(
    bytes,
    contract,
    document.documentTypeName,
    version,
  );
  // Entropy belongs to the JS wrapper rather than the serialized core document,
  // so restore it after the contract-aware property round trip.
  prepared.entropy = document.entropy;
  return prepared;
}

export function documentId(doc, protocolVersion) {
  return String(
    doc.id ??
      doc.toJSON?.(protocolVersion)?.$id ??
      doc.toJSON?.(protocolVersion)?.id ??
      "",
  );
}

export function rows(result) {
  return result instanceof Map
    ? [...result.values()].filter(Boolean)
    : Array.isArray(result)
      ? result
      : Object.values(result || {}).filter(Boolean);
}

export async function queryAll(sdk, args, pageSize = 2) {
  const found = [];
  const seen = new Set();
  let startAfter;
  for (;;) {
    const page = rows(
      await sdk.documents.query({
        ...args,
        limit: pageSize,
        ...(startAfter ? { startAfter } : {}),
      }),
    );
    for (const doc of page) {
      const id = documentId(doc, sdk.version());
      assert(id && !seen.has(id), `Duplicate/cyclic pagination result: ${id}`);
      seen.add(id);
      found.push(doc);
    }
    if (page.length < pageSize) return found;
    const next = documentId(page.at(-1), sdk.version());
    assert(next && next !== startAfter, "Pagination cursor did not advance");
    startAfter = next;
  }
}

export function snapshot(value, version) {
  return value.toObject?.(version) ?? value.toJSON?.(version) ?? value;
}

export function errorDetails(error) {
  let message;
  try {
    message =
      typeof error?.message === "function" ? error.message() : error?.message;
  } catch {
    message = undefined;
  }
  message ||= String(error);
  let decodedMessage;
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(message)) {
    try {
      const decoded = Buffer.from(message, "base64").toString("utf8");
      decodedMessage = decoded
        .replace(/[^\x20-\x7E]+/g, "")
        .replace(/^gmessagex?/, "");
    } catch {
      decodedMessage = undefined;
    }
  }
  return {
    name: error?.name,
    code: error?.code ?? error?.errorCode,
    message,
    ...(decodedMessage ? { decodedMessage } : {}),
  };
}

export function printReport(report) {
  console.log(
    JSON.stringify(
      report,
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
  );
}

export async function networkContext(sdk) {
  const status = await sdk.system.status();
  const raw = status?.toJSON?.() ?? status;
  const protocol = raw?.version?.protocol?.drive;
  return {
    negotiatedProtocolVersion: sdk.version(),
    activeProtocolVersion: protocol?.current ?? null,
    latestKnownProtocolVersion: protocol?.latest ?? null,
    blockHeight:
      raw?.chain?.latestBlockHeight ??
      raw?.chain?.blockHeight ??
      raw?.blockHeight ??
      null,
  };
}
