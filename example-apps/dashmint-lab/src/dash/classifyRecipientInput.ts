/**
 * Classifies a trimmed recipient input as a DPNS name, a potential identity
 * ID, or an invalid string.
 *
 * Distinguishing names from identity IDs relies on character set, not length
 * (DPNS labels can be much longer than a 44-char base58 ID). The base58
 * alphabet excludes `0 O I l` and `-`; DPNS labels are `[a-z0-9-]` (and the
 * full name contains `.dash`). Uppercase is accepted for names since we
 * lowercase before querying DPNS.
 */
export type RecipientMode = "name" | "ambiguous" | "invalid";

const NON_RECIPIENT_CHAR = /[^A-Za-z0-9.-]/;
const NAME_ONLY_CHAR = /[-0OIl]/;

export function classifyRecipientInput(trimmed: string): RecipientMode {
  if (!trimmed) return "invalid";
  if (NON_RECIPIENT_CHAR.test(trimmed)) return "invalid";
  if (trimmed.includes(".")) return "name";
  if (NAME_ONLY_CHAR.test(trimmed)) return "name";
  return "ambiguous";
}
