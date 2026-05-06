import {
  IdentitySigner,
  PrivateKey,
  Purpose,
  SecurityLevel,
} from "@dashevo/evo-sdk";

import type { DashAuth, DashSdk } from "./types";

export class UnknownIdentityError extends Error {
  constructor() {
    super("No identity is registered with this key on testnet.");
    this.name = "UnknownIdentityError";
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
      `Found identity ${identityId}, but this key can't sign document or contract operations. Paste a HIGH or CRITICAL authentication key instead.`,
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
    super("This doesn't look like a valid private key (WIF).");
    this.name = "InvalidPrivateKeyError";
  }
}

interface IdentityJsonKey {
  id: number;
  purpose: number;
  securityLevel: number;
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
 * but some versions emit hex. We try base64 first (preferred), then hex,
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

// Document and contract state transitions require HIGH or CRITICAL auth.
// MASTER (key 0) can only sign identity-update transitions, so a user who
// pastes their master WIF would log in successfully but fail at the first
// note write — reject up front with a clear message instead.
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
): Promise<ResolvedWifIdentity> {
  let privateKey: PrivateKey;
  try {
    privateKey = PrivateKey.fromWIF(wif);
  } catch {
    throw new InvalidPrivateKeyError();
  }

  const pubKeyHash = privateKey.getPublicKeyHash();

  const identity = (await sdk.identities.byPublicKeyHash(
    pubKeyHash as never,
  )) as IdentityLike | undefined | null;
  if (!identity) {
    throw new UnknownIdentityError();
  }

  const identityId =
    typeof identity.id === "string" ? identity.id : identity.id.toString();

  const json = identity.toJSON?.();
  const publicKeys = json?.publicKeys ?? [];
  if (publicKeys.length === 0) {
    // Shouldn't happen — byPublicKeyHash matched, so a key exists. Treat as
    // an unexpected SDK response and fail closed.
    throw new UnknownIdentityError();
  }

  // Get the public key bytes our WIF derives, so we can identify which
  // entry in publicKeys[] is ours.
  const pkAny = privateKey as unknown as {
    getPublicKey?: () => unknown;
    toPublicKey?: () => unknown;
  };
  const ourPubKey = pkAny.getPublicKey
    ? pkAny.getPublicKey()
    : pkAny.toPublicKey?.();
  const ourPubKeyBytes: Uint8Array | null = ourPubKey
    ? extractPubKeyBytes(ourPubKey)
    : null;

  const matched = publicKeys.find((entry) => {
    if (!entry.data || !ourPubKeyBytes) return false;
    const entryBytes = tryDecodeKeyData(entry.data);
    return entryBytes ? bytesEqual(entryBytes, ourPubKeyBytes) : false;
  });
  if (!matched) {
    // Hash matched but we couldn't reconcile against any entry in the JSON
    // (likely a data-encoding skew). Treat as unexpected and fail closed
    // rather than silently picking the first key.
    throw new UnknownIdentityError();
  }

  if (matched.disabled === true || matched.disabledAt) {
    throw new KeyDisabledError(identityId);
  }

  const purposeValue = matched.purpose;
  const securityLevelValue = matched.securityLevel;
  const isAuthPurpose =
    purposeValue === (Purpose.AUTHENTICATION as unknown as number);
  const isAuthLevel = AUTH_SECURITY_LEVELS.has(securityLevelValue);
  if (!isAuthPurpose || !isAuthLevel) {
    throw new WrongKeyPurposeError(
      identityId,
      purposeName(purposeValue),
      securityLevelName(securityLevelValue),
    );
  }

  const identityKey = identity.getPublicKeyById?.(matched.id);
  return { identity, identityId, matched, identityKey };
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
): Promise<DashAuth & { identityId: string }> {
  const resolved = await resolveIdentityFromWif(sdk, wif);
  const signer = new IdentitySigner();
  signer.addKeyFromWif(wif);

  return {
    identity: resolved.identity as never,
    identityKey: resolved.identityKey as never,
    signer,
    identityId: resolved.identityId,
  };
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
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i += 1) {
          bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        }
        return bytes;
      }
    } catch {
      // fall through
    }
  }
  return null;
}
