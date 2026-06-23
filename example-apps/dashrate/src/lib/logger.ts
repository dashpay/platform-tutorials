export type LogLevel = "info" | "success" | "error";
export type Logger = (message: string, level?: LogLevel) => void;

export const consoleLogger: Logger = (message, level = "info") => {
  const fn =
    level === "error"
      ? console.error
      : level === "success"
        ? console.log
        : console.info;
  fn(`[dashrate:${level}] ${message}`);
};

function readCborTextLength(
  bytes: Uint8Array,
  offset: number,
): [number, number] | null {
  const head = bytes[offset];
  if (head >> 5 !== 3) return null;
  const additional = head & 0x1f;
  if (additional < 24) return [additional, offset + 1];
  if (additional === 24) return [bytes[offset + 1], offset + 2];
  if (additional === 25) {
    return [(bytes[offset + 1] << 8) + bytes[offset + 2], offset + 3];
  }
  return null;
}

function readCborText(
  bytes: Uint8Array,
  offset: number,
): [string, number] | null {
  const lengthResult = readCborTextLength(bytes, offset);
  if (!lengthResult) return null;
  const [length, textOffset] = lengthResult;
  const end = textOffset + length;
  if (end > bytes.length) return null;
  return [new TextDecoder().decode(bytes.slice(textOffset, end)), end];
}

function decodeBase64CborMessage(value: string): string | null {
  if (!/^[A-Za-z0-9+/=_-]+$/.test(value) || value.length < 8) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    if (bytes[0] !== 0xa1) return null;
    const key = readCborText(bytes, 1);
    if (!key || key[0] !== "message") return null;
    const message = readCborText(bytes, key[1]);
    return message?.[0] || null;
  } catch {
    return null;
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return decodeBase64CborMessage(err) ?? err;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message) return obj.message;
    if (typeof obj.message === "function") {
      try {
        const message = obj.message();
        if (typeof message === "string" && message) return message;
      } catch {
        // Fall through to the other SDK/WASM shapes below.
      }
    }
    if (typeof obj.name === "string" && obj.name) {
      const parts = [obj.name];
      if (typeof obj.kind === "string" && obj.kind) parts.push(obj.kind);
      if (typeof obj.code === "number") parts.push(`code ${obj.code}`);
      return parts.join(": ");
    }
    const stringified = String(err);
    if (stringified && stringified !== "[object Object]") return stringified;
  }
  try {
    const json = JSON.stringify(err);
    if (json && json !== "{}") return json;
  } catch {
    // Fall through.
  }
  return "Unknown error";
}
