/**
 * Create a new note document.
 *
 * SDK method: sdk.documents.create({ document, identityKey, signer })
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

export interface CreateNoteParams {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  title?: string;
  message: string;
  log?: Logger;
}

export async function createNote({
  sdk,
  keyManager,
  contractId,
  title,
  message,
  log,
}: CreateNoteParams): Promise<string> {
  log?.("Creating note…");
  const { identity, identityKey, signer } = await keyManager.getAuth();
  const { Document } = await loadSdkModule();
  const trimmedTitle = title?.trim();
  const document = new Document({
    properties: {
      ...(trimmedTitle ? { title: trimmedTitle } : {}),
      message,
    },
    documentTypeName: "note",
    dataContractId: contractId,
    ownerId: identity.id,
  });

  await sdk.documents.create({
    document,
    identityKey,
    signer,
  });

  const json =
    typeof document.toJSON === "function"
      ? (document.toJSON() as Record<string, unknown>)
      : {};
  const noteId = String(json.$id ?? json.id ?? "");
  if (!noteId) {
    throw new Error("Created note returned no ID.");
  }
  log?.("Note created.", "success");
  return noteId;
}
