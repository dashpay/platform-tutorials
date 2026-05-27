/**
 * Mint a new card (create a document against the card data contract).
 *
 * Attack and defense are rolled client-side (1-10 each). Name is required,
 * description is optional.
 *
 * Scarcity comes from the contract, not this function: the `card` document
 * type has `tokenCost.create` configured to burn 1 token at position 0.
 * Passing `tokenPaymentInfo` below is the caller's agreement to spend that
 * DashMint token, so each successful document create consumes one fixed-supply
 * token and reduces the remaining mint capacity.
 *
 * SDK method: sdk.documents.create({ document, identityKey, signer, tokenPaymentInfo })
 */
import { Document } from "@dashevo/evo-sdk";

import type { Logger } from "./logger";
import { DASHMINT_TOKEN_PAYMENT_INFO } from "./dashMintToken";
import type { DashKeyManager, DashSdk } from "./types";

export interface MintCardInput {
  name: string;
  description?: string;
  /** Override for deterministic tests. Default: random 1-10. */
  attack?: number;
  /** Override for deterministic tests. Default: random 1-10. */
  defense?: number;
}

export interface MintCardParams {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  card: MintCardInput;
  log?: Logger;
}

function rollStat(): number {
  return Math.floor(Math.random() * 10) + 1;
}

export async function mintCard({
  sdk,
  keyManager,
  contractId,
  card,
  log,
}: MintCardParams): Promise<void> {
  const name = card.name.trim();
  if (!name) throw new Error("Card name is required.");

  const attack = card.attack ?? rollStat();
  const defense = card.defense ?? rollStat();
  const description = card.description?.trim();

  log?.(
    `Burning 1 DashMint token to mint "${name}" (ATK ${attack} / DEF ${defense})…`,
  );

  const { identity, identityKey, signer } = await keyManager.getAuth();

  const properties: Record<string, unknown> = { name, attack, defense };
  if (description) properties.description = description;

  const doc = new Document({
    properties,
    documentTypeName: "card",
    dataContractId: contractId,
    ownerId: identity.id,
  });

  await sdk.documents.create({
    document: doc,
    identityKey,
    signer,
    tokenPaymentInfo: DASHMINT_TOKEN_PAYMENT_INFO,
  });
  log?.(`Card "${name}" minted!`, "success");
}
