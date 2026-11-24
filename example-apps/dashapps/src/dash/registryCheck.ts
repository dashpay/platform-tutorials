import { requireId } from "./ids";
import type { ReadSdk } from "./types";

export const REGISTRY_DOCUMENT_TYPES = [
  "appMetadata",
  "appEndorsement",
  "appReview",
] as const;

const checked = new WeakMap<ReadSdk, Map<string, Promise<string[]>>>();

/**
 * The document types this app reads that the registry contract lacks. An
 * older registry fails every read with "document type not found", so the app
 * checks once per registry ID and connection. A missing contract returns [].
 */
export function missingDocumentTypes(
  sdk: ReadSdk,
  registryId: string,
): Promise<string[]> {
  const id = requireId(registryId);
  let cache = checked.get(sdk);
  if (!cache) checked.set(sdk, (cache = new Map()));
  let result = cache.get(id);
  if (!result) {
    result = sdk.contracts.getMany([id]).then((contracts) => {
      const schemas = contracts.get(id)?.schemas;
      return schemas
        ? REGISTRY_DOCUMENT_TYPES.filter((type) => !(type in schemas))
        : [];
    });
    cache.set(id, result);
    // Let a failed check run again.
    result.catch(() => cache.delete(id));
  }
  return result;
}
