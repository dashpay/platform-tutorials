/**
 * Delete a note document.
 *
 * SDK method: sdk.documents.delete({ document, identityKey, signer })
 */
import type { Logger } from "../lib/logger";
import type { DashKeyManager, DashSdk } from "./types";

export interface DeleteNoteParams {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  noteId: string;
  log?: Logger;
}

export async function deleteNote({
  sdk,
  keyManager,
  contractId,
  noteId,
  log,
}: DeleteNoteParams): Promise<void> {
  log?.(`Deleting note ${noteId}…`);
  const { identity, identityKey, signer } = await keyManager.getAuth();
  await sdk.documents.delete({
    document: {
      id: noteId,
      ownerId: identity.id,
      dataContractId: contractId,
      documentTypeName: "note",
    },
    identityKey,
    signer,
  });
  log?.("Note deleted.", "success");
}
