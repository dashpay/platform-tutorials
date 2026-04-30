/**
 * NFT card data contract schema + registerContract / ensureContract.
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
 * Storage helpers (loadStoredContractId, saveContractId, …) and the owner
 * lookup live in contractStorage.ts so they can be imported without
 * pulling the @dashevo/evo-sdk runtime into the entry bundle.
 *
 * SDK methods: new DataContract({ ... }), sdk.contracts.publish(...)
 */
import { DataContract } from "@dashevo/evo-sdk";

import { loadStoredContractId, saveContractId } from "./contractStorage";
import type { Logger } from "./logger";
import type { DashKeyManager, DashSdk } from "./types";

export {
  DEFAULT_CONTRACT_ID,
  clearStoredContractId,
  fetchContractOwnerId,
  loadStoredContractId,
  saveContractId,
} from "./contractStorage";

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
  const contractId = published.id?.toString() || published.toJSON?.()?.id;

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
