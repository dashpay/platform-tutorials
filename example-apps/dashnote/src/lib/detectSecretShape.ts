/**
 * Decide whether a pasted secret is a BIP39 mnemonic or a WIF private key.
 *
 * BIP39 mnemonics are space-separated word lists; WIF keys are base58-encoded
 * with no whitespace. The two formats don't overlap, so a whitespace check is
 * a sufficient discriminator. The downstream parser does the real validation.
 */
export type SecretShape = "mnemonic" | "wif";

export function detectSecretShape(input: string): SecretShape {
  return /\s/.test(input.trim()) ? "mnemonic" : "wif";
}

// Bitcoin/Dash base58 alphabet (no 0, O, I, l).
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

/**
 * Cheap, local "looks like a WIF" check used to gate eager identity lookup.
 *
 * Catches obviously-incomplete input (still typing, wrong charset, wrong
 * length) without invoking the WASM PrivateKey parser. Returning true does
 * NOT mean the WIF is valid — only that it's worth handing to the parser.
 * Authoritative validation (checksum, version byte) is done downstream by
 * `PrivateKey.fromWIF`.
 */
export function looksLikeWif(input: string): boolean {
  const trimmed = input.trim();
  // Compressed WIF is 52 chars, uncompressed is 51. Anything else is partial.
  if (trimmed.length !== 51 && trimmed.length !== 52) return false;
  return BASE58_RE.test(trimmed);
}
