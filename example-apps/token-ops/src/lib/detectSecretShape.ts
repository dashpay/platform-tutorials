export type SecretShape = "mnemonic" | "wif";

/**
 * BIP39 mnemonics are whitespace-separated word lists; WIF keys are base58
 * strings without whitespace. Real validation happens in the selected parser.
 */
export function detectSecretShape(input: string): SecretShape {
  return /\s/.test(input.trim()) ? "mnemonic" : "wif";
}
