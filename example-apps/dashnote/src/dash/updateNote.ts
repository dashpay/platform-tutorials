/**
 * Update an existing note. Fetches the current document to bump its revision,
 * then submits a replace state transition.
 *
 * SDK methods:
 *   sdk.documents.get(contractId, documentTypeName, documentId)
 *   sdk.documents.replace({ document, identityKey, signer })
 */
import type { Logger } from "../lib/logger";
import { loadSdkModule } from "./sdkModule";
import type { DashKeyManager, DashSdk } from "./types";

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
  log?.(`Saving note ${noteId.slice(0, 8)}…`, {
    level: "info",
    detail: "documents.get → replace",
  });
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
  log?.("Note saved.", {
    level: "success",
    detail: `rev ${revision.toString()}`,
  });
}
