/**
 * Mint a new card (create a document against the card data contract).
 *
 * Attack and defense are rolled client-side (1-10 each). Name is required,
 * description is optional.
 *
 * SDK method: sdk.documents.create({ document, identityKey, signer })
 */
import { Document } from '@dashevo/evo-sdk';

import type { Logger } from './logger';

export interface MintCardInput {
  name: string;
  description?: string;
  /** Override for deterministic tests. Default: random 1-10. */
  attack?: number;
  /** Override for deterministic tests. Default: random 1-10. */
  defense?: number;
}

export interface MintCardParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdk: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  keyManager: any;
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
  if (!name) throw new Error('Card name is required.');

  const attack = card.attack ?? rollStat();
  const defense = card.defense ?? rollStat();
  const description = card.description?.trim();

  log?.(`Minting "${name}" (ATK ${attack} / DEF ${defense})…`);

  const { identity, identityKey, signer } = await keyManager.getAuth();

  const properties: Record<string, unknown> = { name, attack, defense };
  if (description) properties.description = description;

  const doc = new Document({
    properties,
    documentTypeName: 'card',
    dataContractId: contractId,
    ownerId: identity.id,
  });

  await sdk.documents.create({ document: doc, identityKey, signer });
  log?.(`Card "${name}" minted!`, 'success');
}
