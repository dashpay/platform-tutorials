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

export class AmbiguousIdentityError extends Error {
  constructor() {
    super(
      "This key matches multiple identities on testnet. Use a different authentication key.",
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
      `Found identity ${identityId}, but this key cannot sign token operations. Paste a HIGH or CRITICAL authentication key instead.`,
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

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

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
      // Try base64 next.
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

  const pkAny = privateKey as unknown as {
    getPublicKey?: () => unknown;
    toPublicKey?: () => unknown;
  };
  const ourPubKey = pkAny.getPublicKey
    ? pkAny.getPublicKey()
    : pkAny.toPublicKey?.();
  const ourPubKeyBytes = ourPubKey ? extractPubKeyBytes(ourPubKey) : null;
  const ourPubKeyHashBytes = normalizePublicKeyHash(pubKeyHash);

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

  const candidates =
    (await sdk.identities.byNonUniquePublicKeyHash?.(pubKeyHash as never)) ??
    [];
  const matches = candidates
    .map((candidate) =>
      matchIdentityKey(
        candidate as IdentityLike,
        ourPubKeyBytes,
        ourPubKeyHashBytes,
      ),
    )
    .filter((match): match is MatchedIdentity => match != null);

  if (matches.length > 1) {
    throw new AmbiguousIdentityError();
  }
  const validMatches = matches.filter((match) => !match.error);
  if (validMatches.length === 1) {
    return resolvedIdentity(validMatches[0]);
  }
  if (matches.length === 1) {
    throw matches[0].error ?? new UnknownIdentityError();
  }
  throw new UnknownIdentityError();
}

function resolvedIdentity(match: MatchedIdentity): ResolvedWifIdentity {
  return {
    identity: match.identity,
    identityId: match.identityId,
    matched: match.matched,
    identityKey: match.identity.getPublicKeyById?.(match.matched.id),
  };
}

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

function matchIdentityKey(
  identity: IdentityLike,
  ourPubKeyBytes: Uint8Array | null,
  ourPubKeyHashBytes: Uint8Array | null,
): MatchedIdentity | null {
  const identityId =
    typeof identity.id === "string" ? identity.id : identity.id.toString();
  const publicKeys = identity.toJSON?.().publicKeys ?? [];
  if (publicKeys.length === 0) return null;

  const matched = publicKeys.find((entry) => {
    if (!entry.data) return false;
    const entryBytes = tryDecodeKeyData(entry.data);
    if (!entryBytes) return false;
    return (
      (ourPubKeyBytes ? bytesEqual(entryBytes, ourPubKeyBytes) : false) ||
      (ourPubKeyHashBytes ? bytesEqual(entryBytes, ourPubKeyHashBytes) : false)
    );
  });
  if (!matched) return null;

  let error: Error | null = null;
  if (matched.disabled === true || matched.disabledAt) {
    error = new KeyDisabledError(identityId);
  } else {
    const purposeValue = matched.purpose;
    const securityLevelValue = matched.securityLevel;
    const isAuthPurpose =
      purposeValue === (Purpose.AUTHENTICATION as unknown as number);
    const isAuthLevel = AUTH_SECURITY_LEVELS.has(securityLevelValue);
    if (!isAuthPurpose || !isAuthLevel) {
      error = new WrongKeyPurposeError(
        identityId,
        purposeName(purposeValue),
        securityLevelName(securityLevelValue),
      );
    }
  }

  return {
    identity,
    identityId,
    matched,
    error,
  };
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
      // Try the next encoder.
    }
  }
  if (typeof candidate.toBuffer === "function") {
    try {
      return new Uint8Array(candidate.toBuffer() as ArrayLike<number>);
    } catch {
      // Try the next encoder.
    }
  }
  if (typeof candidate.toString === "function") {
    try {
      const hex = candidate.toString("hex");
      if (typeof hex === "string" && /^[0-9a-fA-F]+$/.test(hex)) {
        return tryDecodeHex(hex);
      }
    } catch {
      // Fall through.
    }
  }
  return null;
}
