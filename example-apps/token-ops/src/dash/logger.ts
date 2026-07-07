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
 * Extract a human-readable message from an unknown thrown value.
 *
 * The Evo SDK (WASM-based) sometimes throws wasm-bindgen–wrapped objects
 * rather than Error instances, but it exposes `message` as a getter — so
 * `typeof obj.message === "string"` reads it just like a plain object's,
 * and we never fall through to a `{"__wbg_ptr":N}` JSON.stringify. This
 * matches the sibling apps' logger (dashmint-lab / dashproof-lab):
 *   - Error               → .message
 *   - { message: string } → .message
 *   - string              → as-is
 *   - otherwise           → JSON.stringify fallback
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}
