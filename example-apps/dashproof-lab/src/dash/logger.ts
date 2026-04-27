/**
 * Shared logger contract for tutorial-facing Platform operations.
 */
export type LogLevel = "info" | "success" | "error";

export type Logger = (message: string, level?: LogLevel) => void;

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
