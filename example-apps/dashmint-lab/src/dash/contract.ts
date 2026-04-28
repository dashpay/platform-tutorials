/**
 * NFT card data contract schema + ensureContract().
 *
 * WHAT: A Dash Platform "data contract" defines the schema for documents.
 * This one describes a single document type (`card`) with four fields
 * (name, description, attack, defense) plus three indices so the app can
 * query by owner, attack, or defense.
 *
 * The three flags at the top of the schema are what make this an NFT:
 *   transferable: 1         — documents can be sent to another identity (0 to disable)
 *   tradeMode: 1            — documents can be priced and purchased (0 to disable)
 *   creationRestrictionMode: 1 — (1 - only the contract owner can mint; 0 - anyone can mint)
 *
 * SDK methods: new DataContract({ ... }), sdk.contracts.publish(...)
 */
import { DataContract } from "@dashevo/evo-sdk";

import type { Logger } from "./logger";
import type { DashKeyManager, DashSdk } from "./types";

export const CARD_SCHEMAS = {
  card: {
    type: "object",
    documentsMutable: false,
    canBeDeleted: true,
    transferable: 1,
    tradeMode: 1,
    creationRestrictionMode: 1,
    properties: {
      name: {
        type: "string",
        description: "Name of the card",
        minLength: 1,
        maxLength: 63,
        position: 0,
      },
      description: {
        type: "string",
        description: "Description of the card",
        minLength: 0,
        maxLength: 256,
        position: 1,
      },
      attack: {
        type: "integer",
        description: "Attack power",
        position: 2,
      },
      defense: {
        type: "integer",
        description: "Defense level",
        position: 3,
      },
    },
    indices: [
      { name: "owner", properties: [{ $ownerId: "asc" }] },
      { name: "attack", properties: [{ attack: "asc" }] },
      { name: "defense", properties: [{ defense: "asc" }] },
    ],
    required: ["name", "attack", "defense"],
    additionalProperties: false,
  },
} as const;

/**
 * Fetch the owner identity ID for a given data contract.
 *
 * SDK method: sdk.contracts.fetch(...)
 */
export async function fetchContractOwnerId({
  sdk,
  contractId,
}: {
  sdk: DashSdk;
  contractId: string;
}): Promise<string | null> {
  const contract = await sdk.contracts.fetch(contractId);
  if (!contract) return null;
  const json =
    typeof contract.toJSON === "function" ? contract.toJSON() : contract;
  const ownerId = json.$ownerId ?? json.ownerId ?? null;
  return ownerId ? String(ownerId) : null;
}

const STORAGE_KEY = "dashmint-lab.contractId";

/**
 * Default contract ID baked into the tutorial so browse-only mode works
 * on a fresh machine without any setup. Comes from the original
 * HTML tutorial's pre-deployed testnet contract. Users can override it
 * in the Settings modal or register their own.
 */
export const DEFAULT_CONTRACT_ID =
  "4eJR4pgV9mQdyoodfTTwFUp3SYBRJbUrJ5X1ViN2zBhY";

export function loadStoredContractId(): string | null {
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CONTRACT_ID;
}

export function saveContractId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
}

export function clearStoredContractId(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Register a fresh NFT card data contract on Platform and persist its ID.
 *
 * SDK methods: sdk.identities.nonce(...), sdk.contracts.publish(...).
 */
export async function registerContract({
  sdk,
  keyManager,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  log?: Logger;
}): Promise<string> {
  log?.("Registering NFT card contract…");
  const { identity, identityKey, signer } = await keyManager.getAuth();
  const identityNonce = await sdk.identities.nonce(identity.id.toString());
  const dataContract = new DataContract({
    ownerId: identity.id,
    identityNonce: (identityNonce || 0n) + 1n,
    schemas: CARD_SCHEMAS,
    fullValidation: true,
  });

  log?.("Publishing contract…");
  const published = await sdk.contracts.publish({
    dataContract,
    identityKey,
    signer,
  });
  const contractId =
    published.id?.toString() || published.toJSON?.()?.id;

  if (!contractId) {
    throw new Error(
      `Contract publish returned no id: ${JSON.stringify(published.toJSON?.() ?? published)}`,
    );
  }

  saveContractId(contractId);
  log?.(`Contract registered: ${contractId}`, "success");
  return contractId;
}

/**
 * Ensure a card data contract exists for this app. If a contract ID is
 * already persisted in localStorage (or passed in), we reuse it. Otherwise
 * publish a fresh contract owned by the signed-in identity and persist its
 * ID for next time.
 */
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
  const fromStorage = existingId ?? loadStoredContractId();
  if (fromStorage) {
    log?.(`Using saved contract ID: ${fromStorage}`);
    return fromStorage;
  }
  return registerContract({ sdk, keyManager, log });
}
