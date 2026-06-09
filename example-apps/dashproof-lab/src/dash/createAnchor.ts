/**
 * Create an immutable proof-of-existence anchor document.
 *
 * SDK method: sdk.documents.create({ document, identityKey, signer })
 */
import { Document } from "@dashevo/evo-sdk";

import { bytesToBase64, bytesToDocumentArray } from "../lib/hash";
import { errorMessage, type Logger } from "./logger";
import type { DashKeyManager, DashSdk } from "./types";

export interface CreateAnchorInput {
  entryHash: Uint8Array;
  chainId: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  note?: string;
  previousId?: Uint8Array;
}

export interface CreateAnchorParams {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  anchor: CreateAnchorInput;
  log?: Logger;
}

export const DUPLICATE_ANCHOR_MESSAGE =
  "This file is already anchored. The proof contract rejects duplicate SHA-256 hashes.";

function isDuplicateAnchorError(err: unknown): boolean {
  const message = errorMessage(err).toLowerCase();
  return (
    message.includes("duplicate") ||
    message.includes("unique") ||
    message.includes("already exists")
  );
}

export async function createAnchor({
  sdk,
  keyManager,
  contractId,
  anchor,
  log,
}: CreateAnchorParams): Promise<void> {
  const chainId = anchor.chainId.trim();
  if (!chainId) throw new Error("Chain ID is required.");
  if (anchor.entryHash.length !== 32) {
    throw new Error("entryHash must be a 32-byte SHA-256 digest.");
  }

  const { identity, identityKey, signer } = await keyManager.getAuth();
  const properties: Record<string, unknown> = {
    entryHash: bytesToBase64(anchor.entryHash),
    chainId,
  };

  const filename = anchor.filename?.trim();
  if (filename) properties.filename = filename;

  const mimeType = anchor.mimeType?.trim();
  if (mimeType) properties.mimeType = mimeType;

  if (typeof anchor.size === "number" && Number.isFinite(anchor.size)) {
    properties.size = Math.trunc(anchor.size);
  }

  const note = anchor.note?.trim();
  if (note) properties.note = note;

  if (anchor.previousId) {
    if (anchor.previousId.length !== 32) {
      throw new Error("previousId must be 32 bytes when provided.");
    }
    properties.previousId = bytesToDocumentArray(anchor.previousId);
  }

  log?.(`Anchoring SHA-256 to chain "${chainId}"…`);
  const document = new Document({
    properties,
    documentTypeName: "anchor",
    dataContractId: contractId,
    ownerId: identity.id,
  });
  try {
    await sdk.documents.create({ document, identityKey, signer });
  } catch (err) {
    if (isDuplicateAnchorError(err)) {
      throw new Error(DUPLICATE_ANCHOR_MESSAGE);
    }
    throw err;
  }
  log?.("Proof anchor submitted.", "success");
}
