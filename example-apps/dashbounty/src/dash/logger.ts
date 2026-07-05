/**
 * Shared logger shape for every Platform operation under src/dash/.
 *
 * Each op accepts an optional `log?: Logger`. The UI's activity feed passes
 * in a logger that streams messages to the on-screen log. When no logger is
 * passed (e.g. in unit tests or scripts), we fall back to console.info.
 */
export type LogLevel = "info" | "success" | "error";

export type Logger = (message: string, level?: LogLevel) => void;

export const consoleLogger: Logger = (msg, level = "info") => {
  const fn =
    level === "error"
      ? console.error
      : level === "success"
        ? console.log
        : console.info;
  fn(`[dash:${level}] ${msg}`);
};

/**
 * Safely read a getter on a wasm-bindgen–backed error object without
 * blowing up if the getter itself throws. wasm-bindgen exposes properties
 * as class getters, not own fields, so `Object.keys(err)` is empty and
 * `JSON.stringify(err)` produces the useless `{"__wbg_ptr":N}`. Reading
 * each getter individually is the only reliable way to extract data.
 */
function tryReadProp(obj: Record<string, unknown>, key: string): unknown {
  try {
    return obj[key];
  } catch {
    return undefined;
  }
}

/**
 * Format a WasmSdkError-shaped object as a human-readable string.
 * WasmSdkError exposes `name`, `message`, `code`, and `isRetriable` as
 * getters. Combining them gives the UI something more useful than either
 * `{__wbg_ptr}` (raw JSON.stringify) or a bare message with no context on
 * whether the caller should retry.
 */
function formatWasmSdkError(obj: Record<string, unknown>): string | null {
  const message = tryReadProp(obj, "message");
  const name = tryReadProp(obj, "name");
  const code = tryReadProp(obj, "code");
  const isRetriable = tryReadProp(obj, "isRetriable");

  const hasMessage = typeof message === "string" && message.length > 0;
  const hasName = typeof name === "string" && name.length > 0;
  const hasCode = typeof code === "number" || typeof code === "string";
  const hasRetriable = typeof isRetriable === "boolean";

  if (!hasMessage && !hasName && !hasCode) return null;

  const head =
    hasName && hasMessage
      ? `${name}: ${message}`
      : hasMessage
        ? String(message)
        : hasName
          ? String(name)
          : "Platform error";
  const tail: string[] = [];
  if (hasCode) tail.push(`code=${code}`);
  if (hasRetriable && isRetriable) tail.push("retriable");
  return tail.length > 0 ? `${head} (${tail.join(", ")})` : head;
}

/**
 * Extract a human-readable message from an unknown thrown value.
 *
 * The Evo SDK (WASM-based) throws wasm-bindgen–wrapped objects (like
 * WasmSdkError) rather than Error instances. This helper walks common
 * shapes to find something useful:
 *   - Error                           → .message
 *   - WasmSdkError-shaped wasm object → "<name>: <message> (code=…, retriable)"
 *   - { message: string }             → .message
 *   - string                          → as-is
 *   - otherwise                       → JSON.stringify fallback
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message) return err.message;
  }
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;

    const wasmFormatted = formatWasmSdkError(obj);
    if (wasmFormatted) return wasmFormatted;

    const message = tryReadProp(obj, "message");
    if (typeof message === "string" && message.length > 0) return message;

    try {
      const serialized = JSON.stringify(err);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      /* fall through */
    }
    return String(err);
  }
  return String(err);
}
