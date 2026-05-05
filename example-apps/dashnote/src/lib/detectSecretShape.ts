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
