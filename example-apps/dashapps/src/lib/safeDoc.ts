export { readId } from "../dash/ids";
export interface DocumentHandle {
  id?: unknown;
  ownerId?: unknown;
  properties?: Record<string, unknown>;
}
export function toDocumentArray(value: unknown): DocumentHandle[] {
  const values =
    value instanceof Map
      ? [...value.values()]
      : Array.isArray(value)
        ? value
        : value && typeof value === "object"
          ? Object.values(value)
          : null;
  if (!values) throw new Error("Malformed document query response.");
  return values
    .filter((value) => value != null)
    .map((value) => {
      if (typeof value !== "object") throw new Error("Malformed document.");
      return value as DocumentHandle;
    });
}
