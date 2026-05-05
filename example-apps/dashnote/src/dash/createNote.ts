/**
 * Create a new note document.
 *
 * SDK method: sdk.documents.create({ document, identityKey, signer })
 */
import { Document } from "@dashevo/evo-sdk";

import type { Logger } from "../lib/logger";
import type { DashKeyManager, DashSdk } from "./types";

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
