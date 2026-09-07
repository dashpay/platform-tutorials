const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export class IdReadError extends Error {
  constructor() {
    super("Expected a valid 32-byte Platform identifier.");
    this.name = "IdReadError";
  }
}
export function bytesToBase58(bytes: Uint8Array): string {
  if (bytes.length !== 32) throw new IdReadError();
  let n = 0n;
  for (const byte of bytes) n = n * 256n + BigInt(byte);
  let encoded = "";
  while (n) {
    encoded = alphabet[Number(n % 58n)] + encoded;
    n /= 58n;
  }
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  return "1".repeat(zeros) + encoded;
}
export function idToBytes(value: string): Uint8Array {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) throw new IdReadError();
  let n = 0n;
  for (const char of value) n = n * 58n + BigInt(alphabet.indexOf(char));
  const bytes: number[] = [];
  while (n) {
    bytes.unshift(Number(n % 256n));
    n /= 256n;
  }
  const zeros = value.match(/^1*/)?.[0].length ?? 0;
  if (zeros + bytes.length !== 32) throw new IdReadError();
  return Uint8Array.from([...Array<number>(zeros).fill(0), ...bytes]);
}
export function isBase58Id(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    idToBytes(value);
    return true;
  } catch {
    return false;
  }
}
export function readId(value: unknown): string | null {
  if (value == null) return null;
  try {
    if (value instanceof Uint8Array) return bytesToBase58(value);
    if (Array.isArray(value)) {
      if (
        value.length !== 32 ||
        !Array.from(value).every(
          (n) => Number.isInteger(n) && n >= 0 && n <= 255,
        )
      )
        throw new IdReadError();
      return bytesToBase58(Uint8Array.from(value));
    }
    const result =
      typeof value === "string"
        ? value
        : typeof value === "object"
          ? String(value)
          : "";
    if (isBase58Id(result)) return result;
  } catch {
    throw new IdReadError();
  }
  throw new IdReadError();
}
export function requireId(value: unknown): string {
  const id = readId(value);
  if (!id) throw new IdReadError();
  return id;
}

/** Canonicality accepts normalized strings only, never implicit coercion. */
export function assertBase58Id(value: unknown): asserts value is string {
  if (!isBase58Id(value)) throw new IdReadError();
}
