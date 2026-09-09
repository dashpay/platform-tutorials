import {
  IdentitySigner,
  PrivateKey,
  Purpose,
  SecurityLevel,
} from "@dashevo/evo-sdk";

import type { DashAuth, DashSdk } from "./types";

export class UnknownIdentityError extends Error {
  constructor() {
    super("No identity is registered with this key on the selected network.");
    this.name = "UnknownIdentityError";
  }
}

export class AmbiguousIdentityError extends Error {
  constructor() {
    super(
      "This key is associated with multiple identities. Enter the full identity ID you want to use.",
    );
    this.name = "AmbiguousIdentityError";
  }
}

export class WrongKeyPurposeError extends Error {
  identityId: string;
  purposeName: string;
  securityLevelName: string;

  constructor(
    identityId: string,
    purposeName: string,
    securityLevelName: string,
  ) {
    super(
      `Found identity ${identityId}, but this key cannot sign state transitions. Paste a HIGH or CRITICAL authentication key instead.`,
    );
    this.name = "WrongKeyPurposeError";
    this.identityId = identityId;
    this.purposeName = purposeName;
    this.securityLevelName = securityLevelName;
  }
}

export class KeyDisabledError extends Error {
  identityId: string;

  constructor(identityId: string) {
    super(`The matching key on identity ${identityId} has been disabled.`);
    this.name = "KeyDisabledError";
    this.identityId = identityId;
  }
}

export class InvalidPrivateKeyError extends Error {
  constructor() {
    super("This does not look like a valid private key (WIF).");
    this.name = "InvalidPrivateKeyError";
  }
}

interface IdentityJsonKey {
  id: number;
  purpose: number;
  securityLevel: number;
  type?: number;
  data?: string;
  disabled?: boolean;
  disabledAt?: number | string | null;
}

interface IdentityJson {
  publicKeys?: IdentityJsonKey[];
}

interface IdentityLike {
  toJSON?: () => IdentityJson;
  id: { toString(): string } | string;
  getPublicKeyById?: (keyId: number) => unknown;
}

/**
 * Compare two byte arrays for equality.
 */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Decode a public-key data field from `identity.toJSON()`.
 *
 * Dash Platform's JSON encoding for bytes has historically been base64,
 * but some versions emit hex. We try hex first, then fall back to base64
 * before giving up. Returning null lets the caller skip a key it can't
 * compare rather than aborting.
 */
function tryDecodeKeyData(data: string): Uint8Array | null {
  if (typeof data !== "string" || data.length === 0) return null;

  if (/^[0-9a-fA-F]+$/.test(data) && data.length % 2 === 0) {
    try {
      const bytes = new Uint8Array(data.length / 2);
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = parseInt(data.slice(i * 2, i * 2 + 2), 16);
      }
      return bytes;
    } catch {
      // fall through to base64
    }
  }

  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

// State transitions require HIGH or CRITICAL authentication.
// MASTER (key 0) can only sign identity-update transitions, so a user who
// pastes their master WIF would log in successfully but fail at the first
// write — reject up front with a clear message instead.
const AUTH_SECURITY_LEVELS = new Set<number>([
  SecurityLevel.HIGH as unknown as number,
  SecurityLevel.CRITICAL as unknown as number,
]);

const PURPOSE_NAMES: Record<number, string> = {
  [Purpose.AUTHENTICATION as unknown as number]: "AUTHENTICATION",
  [Purpose.ENCRYPTION as unknown as number]: "ENCRYPTION",
  [Purpose.TRANSFER as unknown as number]: "TRANSFER",
};

const SECURITY_LEVEL_NAMES: Record<number, string> = {
  [SecurityLevel.MASTER as unknown as number]: "MASTER",
  [SecurityLevel.CRITICAL as unknown as number]: "CRITICAL",
  [SecurityLevel.HIGH as unknown as number]: "HIGH",
  [SecurityLevel.MEDIUM as unknown as number]: "MEDIUM",
};

function purposeName(purpose: number): string {
  return PURPOSE_NAMES[purpose] ?? `PURPOSE_${purpose}`;
}

function securityLevelName(level: number): string {
  return SECURITY_LEVEL_NAMES[level] ?? `LEVEL_${level}`;
}

interface ResolvedWifIdentity {
  identity: IdentityLike;
  identityId: string;
  matched: IdentityJsonKey;
  identityKey: unknown;
}

interface MatchedIdentity {
  identity: IdentityLike;
  identityId: string;
  matched: IdentityJsonKey;
  error: Error | null;
}

/**
 * Resolve which identity a WIF private key belongs to and which key on that
 * identity it matches, without building a signer. Performs every check the
 * full login does (WIF parse, identity lookup, key-purpose / disabled / level
 * validation) and throws the same error types — this is the shared core for
 * both eager preview and the actual login.
 *
 * The signer construction is split out so the preview path can avoid touching
 * the WASM signer until the user commits to logging in.
 */
export async function resolveIdentityFromWif(
  sdk: DashSdk,
  wif: string,
  expectedIdentityId?: string,
): Promise<ResolvedWifIdentity> {
  let privateKey: PrivateKey;
  try {
    privateKey = PrivateKey.fromWIF(wif);
  } catch {
    throw new InvalidPrivateKeyError();
  }

  const pubKeyHash = privateKey.getPublicKeyHash();

  // Get the public key bytes our WIF derives, so we can identify which
  // entry in publicKeys[] is ours.
  const pkAny = privateKey as unknown as {
    getPublicKey?: () => unknown;
    toPublicKey?: () => unknown;
  };
  const ourPubKey = pkAny.getPublicKey
    ? pkAny.getPublicKey()
    : pkAny.toPublicKey?.();
  const ourPubKeyBytes = ourPubKey ? extractPubKeyBytes(ourPubKey) : null;
  const ourPubKeyHashBytes = normalizePublicKeyHash(pubKeyHash);
  const expected = expectedIdentityId?.trim() || null;

  if (expected) {
    const expectedIdentity = (await sdk.identities.fetch(expected)) as
      | IdentityLike
      | undefined
      | null;
    if (!expectedIdentity) throw new UnknownIdentityError();
    const selected = matchIdentityKey(
      expectedIdentity,
      ourPubKeyBytes,
      ourPubKeyHashBytes,
    );
    if (!selected) throw new UnknownIdentityError();
    if (selected.error) throw selected.error;
    return resolvedIdentity(selected);
  }

  const identity = (await sdk.identities.byPublicKeyHash(
    pubKeyHash as never,
  )) as IdentityLike | undefined | null;

  if (identity) {
    const match = matchIdentityKey(
      identity,
      ourPubKeyBytes,
      ourPubKeyHashBytes,
    );
    if (!match) throw new UnknownIdentityError();
    if (match.error) throw match.error;
    return resolvedIdentity(match);
  }

  const matches = await findNonUniqueMatches(
    sdk,
    pubKeyHash,
    ourPubKeyBytes,
    ourPubKeyHashBytes,
  );
  if (matches.length > 1) throw new AmbiguousIdentityError();
  if (matches.length === 1) {
    if (matches[0].error) throw matches[0].error;
    return resolvedIdentity(matches[0]);
  }
  throw new UnknownIdentityError();
}

async function findNonUniqueMatches(
  sdk: DashSdk,
  pubKeyHash: unknown,
  ourPubKeyBytes: Uint8Array | null,
  ourPubKeyHashBytes: Uint8Array | null,
): Promise<MatchedIdentity[]> {
  const lookup = sdk.identities.byNonUniquePublicKeyHash;
  if (!lookup) return [];

  const matches: MatchedIdentity[] = [];
  let startAfter: string | undefined;
  const seenCursors = new Set<string>();

  while (true) {
    const candidates = await lookup.call(
      sdk.identities,
      pubKeyHash as never,
      startAfter,
    );
    if (candidates.length === 0) break;

    const cursor = identityIdOf(
      candidates[candidates.length - 1] as IdentityLike,
    );
    if (seenCursors.has(cursor)) {
      throw new Error("Non-unique identity lookup pagination did not advance.");
    }
    seenCursors.add(cursor);

    for (const candidate of candidates) {
      const match = matchIdentityKey(
        candidate as IdentityLike,
        ourPubKeyBytes,
        ourPubKeyHashBytes,
      );
      if (match) matches.push(match);
      // We only need to establish ambiguity, not enumerate identities.
      if (matches.length > 1) return matches;
    }

    startAfter = cursor;
  }

  return matches;
}

function resolvedIdentity(match: MatchedIdentity): ResolvedWifIdentity {
  return {
    identity: match.identity,
    identityId: match.identityId,
    matched: match.matched,
    identityKey: match.identity.getPublicKeyById?.(match.matched.id),
  };
}

/**
 * Look up an identity from a WIF private key and prepare a one-key signer
 * for auth-purpose operations.
 *
 * Thin wrapper around `resolveIdentityFromWif` that adds signer construction.
 */
export async function loginWithPrivateKey(
  sdk: DashSdk,
  wif: string,
  expectedIdentityId?: string,
): Promise<DashAuth & { identityId: string }> {
  const resolved = await resolveIdentityFromWif(sdk, wif, expectedIdentityId);
  const signer = new IdentitySigner();
  signer.addKeyFromWif(wif);

  return {
    identity: resolved.identity as never,
    identityKey: resolved.identityKey as never,
    signer,
    identityId: resolved.identityId,
  };
}

function matchIdentityKey(
  identity: IdentityLike,
  ourPubKeyBytes: Uint8Array | null,
  ourPubKeyHashBytes: Uint8Array | null,
): MatchedIdentity | null {
  const identityId =
    typeof identity.id === "string" ? identity.id : identity.id.toString();
  const publicKeys = identity.toJSON?.().publicKeys ?? [];
  const matched = publicKeys.find((entry) => {
    if (!entry.data) return false;
    const entryBytes = tryDecodeKeyData(entry.data);
    if (!entryBytes) return false;
    // SDK JSON uses type 0 for a full secp256k1 key and type 2 for its
    // HASH160 representation. Do not treat other 20-byte key types (such as
    // BIP13 script hashes or EDDSA HASH160) as signable by this WIF. Older
    // SDK/test shapes may omit `type`, where byte length remains unambiguous.
    const isFullEcdsa = entry.type === undefined || entry.type === 0;
    const isEcdsaHash160 = entry.type === undefined || entry.type === 2;
    return (
      (isFullEcdsa && ourPubKeyBytes
        ? bytesEqual(entryBytes, ourPubKeyBytes)
        : false) ||
      (isEcdsaHash160 && ourPubKeyHashBytes
        ? bytesEqual(entryBytes, ourPubKeyHashBytes)
        : false)
    );
  });
  if (!matched) return null;

  let error: Error | null = null;
  if (matched.disabled === true || matched.disabledAt) {
    error = new KeyDisabledError(identityId);
  } else {
    const isAuthPurpose =
      matched.purpose === (Purpose.AUTHENTICATION as unknown as number);
    const isAuthLevel = AUTH_SECURITY_LEVELS.has(matched.securityLevel);
    if (!isAuthPurpose || !isAuthLevel) {
      error = new WrongKeyPurposeError(
        identityId,
        purposeName(matched.purpose),
        securityLevelName(matched.securityLevel),
      );
    }
  }
  return { identity, identityId, matched, error };
}

function identityIdOf(identity: IdentityLike): string {
  return typeof identity.id === "string" ? identity.id : identity.id.toString();
}

function normalizePublicKeyHash(hash: unknown): Uint8Array | null {
  if (hash instanceof Uint8Array) return hash;
  if (Array.isArray(hash)) return new Uint8Array(hash);
  if (typeof hash === "string") return tryDecodeHex(hash);
  return null;
}

function tryDecodeHex(hex: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Pull the raw compressed public key bytes from a `PrivateKey.toPublicKey()`
 * result. The SDK exposes a few encoders depending on version (toBytes(),
 * toBuffer(), toString('hex'), etc.) — we try each in order.
 */
function extractPubKeyBytes(pubKey: unknown): Uint8Array | null {
  const candidate = pubKey as {
    toBytes?: () => Uint8Array | ArrayLike<number>;
    toBuffer?: () => Uint8Array | ArrayLike<number>;
    toString?: (encoding?: string) => string;
  };

  if (typeof candidate.toBytes === "function") {
    try {
      return new Uint8Array(candidate.toBytes() as ArrayLike<number>);
    } catch {
      // fall through
    }
  }
  if (typeof candidate.toBuffer === "function") {
    try {
      return new Uint8Array(candidate.toBuffer() as ArrayLike<number>);
    } catch {
      // fall through
    }
  }
  if (typeof candidate.toString === "function") {
    try {
      const hex = candidate.toString("hex");
      if (typeof hex === "string" && /^[0-9a-fA-F]+$/.test(hex)) {
        return tryDecodeHex(hex);
      }
    } catch {
      // fall through
    }
  }
  return null;
}
