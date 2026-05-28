/**
 * Update an existing note. Fetches the current document to bump its revision,
 * then submits a replace state transition.
 *
 * Pass `expectedRevision` to refuse the update if the network's revision
 * doesn't match — i.e. the note was changed on the network after the local
 * copy was loaded.
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
  expectedRevision?: number;
  log?: Logger;
}

export async function updateNote({
  sdk,
  keyManager,
  contractId,
  noteId,
  title,
  message,
  expectedRevision,
  log,
}: UpdateNoteParams): Promise<bigint> {
  log?.(`Saving note ${noteId}…`);
  const { identity, identityKey, signer } = await keyManager.getAuth();
  const existingDoc = await sdk.documents.get(contractId, "note", noteId);
  if (!existingDoc) {
    throw new Error(`Note ${noteId} not found.`);
  }

  const currentRevision = BigInt(existingDoc.revision ?? 0);
  if (
    expectedRevision !== undefined &&
    currentRevision !== BigInt(expectedRevision)
  ) {
    throw new Error(
      `Note changed on network (you had revision ${expectedRevision}, network is at ${currentRevision}). Reload your notes and try again.`,
    );
  }

  const { Document } = await loadSdkModule();
  const revision = currentRevision + 1n;
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
  return revision;
}
