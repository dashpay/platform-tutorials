/**
 * Update an existing note. Fetches the current document to bump its revision,
 * then submits a replace state transition.
 *
 * SDK methods:
 *   sdk.documents.get(contractId, documentTypeName, documentId)
 *   sdk.documents.replace({ document, identityKey, signer })
 */
import type { Logger } from "../lib/logger";
import type { DashKeyManager, DashSdk } from "./types";

// Defer the @dashevo/evo-sdk value import so it doesn't anchor the SDK chunk
// to the entry graph via NotesWorkspace's static import of this file. Cached
// after first call; cleared on failure so a transient chunk fetch can retry.
type SdkModule = typeof import("@dashevo/evo-sdk");
let sdkModulePromise: Promise<SdkModule> | null = null;
function loadSdkModule(): Promise<SdkModule> {
  if (!sdkModulePromise) {
    sdkModulePromise = import("@dashevo/evo-sdk").catch((err) => {
      sdkModulePromise = null;
      throw err;
    });
  }
  return sdkModulePromise;
}

export interface UpdateNoteParams {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  noteId: string;
  title?: string;
  message: string;
  log?: Logger;
}

export async function updateNote({
  sdk,
  keyManager,
  contractId,
  noteId,
  title,
  message,
  log,
}: UpdateNoteParams): Promise<void> {
  log?.(`Saving note ${noteId}…`);
  const { identity, identityKey, signer } = await keyManager.getAuth();
  const existingDoc = await sdk.documents.get(contractId, "note", noteId);
  if (!existingDoc) {
    throw new Error(`Note ${noteId} not found.`);
  }

  const { Document } = await loadSdkModule();
  const revision = BigInt(existingDoc.revision ?? 0) + 1n;
  const trimmedTitle = title?.trim();
  const document = new Document({
    properties: {
      ...(trimmedTitle ? { title: trimmedTitle } : {}),
      message,
    },
    documentTypeName: "note",
    dataContractId: contractId,
    ownerId: identity.id,
    revision,
    id: noteId,
  });

  await sdk.documents.replace({
    document,
    identityKey,
    signer,
  });
  log?.("Note saved.", "success");
}
