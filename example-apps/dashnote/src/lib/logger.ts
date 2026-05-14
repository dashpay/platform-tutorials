/**
 * Shared logger contract for tutorial-facing Platform operations.
 */
export type LogLevel = "info" | "success" | "error";

export interface LogOptions {
  level?: LogLevel;
  detail?: string;
}

// Positional `LogLevel` second arg is accepted for backwards-compatibility with
// existing call sites (`log("…", "success")`); new code should pass the object
// form so it can carry `detail` for the activity panel.
export type Logger = (
  message: string,
  levelOrOptions?: LogLevel | LogOptions,
) => void;

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  detail?: string;
  timestamp: number;
}

export const ACTIVITY_LOG_LIMIT = 200;

export function normalizeLogOptions(
  levelOrOptions?: LogLevel | LogOptions,
): LogOptions {
  if (!levelOrOptions) return {};
  if (typeof levelOrOptions === "string") return { level: levelOrOptions };
  return levelOrOptions;
}

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
