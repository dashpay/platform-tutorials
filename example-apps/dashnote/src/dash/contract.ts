/**
 * Note data contract: schema definition + registration.
 *
 * SDK methods:
 *   sdk.contracts.publish({ dataContract, identityKey, signer })
 *   sdk.identities.nonce(identityId)
 */
import { DataContract, Identifier } from "@dashevo/evo-sdk";

import type { Logger } from "../lib/logger";
import type { DashKeyManager, DashSdk } from "./types";

export const NOTE_SCHEMAS = {
  note: {
    type: "object",
    documentsMutable: true,
    canBeDeleted: true,
    properties: {
      title: {
        type: "string",
        maxLength: 120,
        position: 0,
      },
      message: {
        type: "string",
        maxLength: 10000,
        position: 1,
      },
    },
    required: ["$createdAt", "$updatedAt", "message"],
    additionalProperties: false,
    indices: [
      {
        name: "byOwnerUpdated",
        properties: [{ $ownerId: "asc" }, { $updatedAt: "asc" }],
      },
      {
        name: "byOwnerCreated",
        properties: [{ $ownerId: "asc" }, { $createdAt: "asc" }],
      },
    ],
  },
} as const;

const STORAGE_KEY = "dashnote.contractId";

/**
 * Default contract ID baked into the tutorial so the notebook UI works on a
 * fresh machine without registering a contract first. Users can override it
 * in Settings or register their own.
 */
export const DEFAULT_CONTRACT_ID =
  "8d6heK6CoskLBi6Rs7cChRG9RuckcZqZst28BdviBe8y";

export function loadStoredContractId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CONTRACT_ID;
  } catch {
    return DEFAULT_CONTRACT_ID;
  }
}

export function saveContractId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
}

export function clearStoredContractId(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function refreshContractCache({
  sdk,
  contractId,
}: {
  sdk: DashSdk;
  contractId: string;
}): Promise<void> {
  if (!contractId || typeof sdk.getWasmSdkConnected !== "function") return;
  const wasm = await sdk.getWasmSdkConnected();
  if (!wasm || typeof wasm.removeCachedContract !== "function") return;
  const identifier = new Identifier(contractId);
  try {
    wasm.removeCachedContract(identifier);
  } finally {
    identifier.free?.();
  }
}

export async function registerContract({
  sdk,
  keyManager,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  log?: Logger;
}): Promise<string> {
  log?.("Registering Dashnote note contract…");
  const { identity, identityKey, signer } = await keyManager.getAuth();
  const identityNonce = await sdk.identities.nonce(identity.id.toString());
  const dataContract = new DataContract({
    ownerId: identity.id,
    identityNonce: (identityNonce || 0n) + 1n,
    schemas: NOTE_SCHEMAS,
    fullValidation: true,
  });

  (
    dataContract as unknown as {
      setConfig: (config: Record<string, unknown>) => void;
    }
  ).setConfig({
    canBeDeleted: false,
    readonly: false,
    // Must stay false: keepsHistory: true triggers dashpay/platform#3165 —
    // sdk.contracts.fetch() returns undefined, breaking sdk.documents.query
    // with "Data contract not found".
    keepsHistory: false,
    documentsKeepHistoryContractDefault: false,
    documentsMutableContractDefault: true,
    documentsCanBeDeletedContractDefault: true,
  });

  const published = await sdk.contracts.publish({
    dataContract,
    identityKey,
    signer,
  });
  const contractId = published.id?.toString() || published.toJSON?.()?.id;
  if (!contractId) {
    throw new Error("Contract publish returned no ID.");
  }

  saveContractId(contractId);
  log?.(`Dashnote contract registered: ${contractId}`, "success");
  return contractId;
}

export async function ensureContract({
  sdk,
  keyManager,
  existingId,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  existingId?: string | null;
  log?: Logger;
}): Promise<string> {
  const reused = existingId ?? loadStoredContractId();
  if (reused) {
    log?.(`Using saved contract ID: ${reused}`);
    return reused;
  }
  return registerContract({ sdk, keyManager, log });
}
