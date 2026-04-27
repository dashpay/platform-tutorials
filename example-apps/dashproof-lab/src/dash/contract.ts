/**
 * Proof-of-existence data contract schema + contract registration helpers.
 *
 * The schema mirrors the requested "Factom-like" anchor design:
 * a browser-generated SHA-256 hash, grouped by chainId, stored immutably.
 *
 * SDK methods: new DataContract({ ... }), sdk.contracts.publish(...)
 */
import { DataContract, Identifier } from "@dashevo/evo-sdk";

import type { Logger } from "./logger";
import type { DashKeyManager, DashSdk } from "./types";

export const ANCHOR_CONTRACT = {
  $schema: "https://schema.dash.org/dpp-0-4-0/meta/data-contract",
  version: 1,
  documents: {
    anchor: {
      type: "object",
      documentsMutable: false,
      canBeDeleted: false,
      properties: {
        entryHash: {
          type: "string",
          minLength: 44,
          maxLength: 44,
          position: 0,
        },
        chainId: {
          type: "string",
          minLength: 1,
          maxLength: 63,
          position: 1,
        },
        filename: {
          type: "string",
          maxLength: 255,
          position: 2,
        },
        mimeType: {
          type: "string",
          maxLength: 127,
          position: 3,
        },
        size: {
          type: "integer",
          position: 4,
        },
        note: {
          type: "string",
          maxLength: 256,
          position: 5,
        },
        previousId: {
          type: "array",
          byteArray: true,
          minItems: 32,
          maxItems: 32,
          position: 6,
        },
      },
      required: ["$createdAt", "entryHash", "chainId"],
      additionalProperties: false,
      indices: [
        {
          name: "byChain",
          properties: [{ chainId: "asc" }, { $createdAt: "asc" }],
        },
        {
          name: "byOwner",
          properties: [{ $ownerId: "asc" }, { $createdAt: "asc" }],
        },
        {
          name: "byHash",
          properties: [{ entryHash: "asc" }],
          unique: true,
        },
      ],
    },
  },
} as const;

const STORAGE_KEY = "dashproof-lab.contractId";

/**
 * Replace this with a deployed anchor contract ID once one exists for this app.
 * Until then, read-only access requires the user to paste or register a contract.
 */
export const DEFAULT_CONTRACT_ID: string | null = null;

export function loadStoredContractId(): string | null {
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CONTRACT_ID;
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
  log?.("Registering proof contract…");
  const { identity, identityKey, signer } = await keyManager.getAuth();
  const identityNonce = await sdk.identities.nonce(identity.id.toString());
  const dataContract = new DataContract({
    ownerId: identity.id,
    identityNonce: (identityNonce || 0n) + 1n,
    schemas: ANCHOR_CONTRACT.documents,
    fullValidation: true,
  });

  const published = await sdk.contracts.publish({
    dataContract,
    identityKey,
    signer,
  });
  const contractId =
    published.id?.toString() || published.toJSON?.()?.id || "unknown";

  saveContractId(contractId);
  log?.(`Proof contract registered: ${contractId}`, "success");
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
