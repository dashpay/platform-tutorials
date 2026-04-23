/**
 * Read queries over the card data contract.
 *
 * Three variants backing the Collection tab's sub-tabs:
 *   listMyCards — cards owned by the signed-in identity (uses where $ownerId)
 *   listAllCards — every card across the network (capped limit)
 *   listMarketplaceCards — every card that has a non-null $price
 *
 * normalizeCards() hides the three possible shapes the SDK may return
 * (Array, Map, or plain object) so UI code always sees a plain array of
 * { id, ownerId, data, $price }.
 *
 * SDK method: sdk.documents.query({ dataContractId, documentTypeName, where?, limit })
 */
import type { Logger } from "./logger.js";

export interface Card {
  id: string;
  ownerId: string;
  data: {
    name?: string;
    description?: string;
    attack?: number;
    defense?: number;
  };
  $price?: number | bigint;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawDoc = any;

function toCard(id: string | null, raw: RawDoc): Card {
  const j: Record<string, unknown> =
    typeof raw?.toJSON === "function" ? raw.toJSON() : raw;
  return {
    id: (id ?? (j.$id as string) ?? (j.id as string)) as string,
    ownerId: j.$ownerId as string,
    data: {
      name: j.name as string | undefined,
      description: j.description as string | undefined,
      attack: j.attack as number | undefined,
      defense: j.defense as number | undefined,
    },
    $price: j.$price as number | bigint | undefined,
  };
}

export function normalizeCards(results: unknown): Card[] {
  if (Array.isArray(results)) return results.map((d) => toCard(null, d));
  const entries =
    results instanceof Map
      ? Object.fromEntries(results)
      : (results as Record<string, RawDoc>);
  return Object.entries(entries).map(([id, d]) => toCard(id, d));
}

interface BaseParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdk: any;
  contractId: string;
  limit?: number;
  log?: Logger;
}

export async function listMyCards({
  sdk,
  contractId,
  identityId,
  limit = 100,
  log,
}: BaseParams & { identityId: string }): Promise<Card[]> {
  log?.("Loading your cards…");
  const results = await sdk.documents.query({
    dataContractId: contractId,
    documentTypeName: "card",
    where: [["$ownerId", "==", identityId]],
    limit,
  });
  const cards = normalizeCards(results);
  log?.(`Found ${cards.length} card(s).`);
  return cards;
}

export async function listAllCards({
  sdk,
  contractId,
  limit = 50,
  log,
}: BaseParams): Promise<Card[]> {
  log?.("Loading all cards (any owner)…");
  const results = await sdk.documents.query({
    dataContractId: contractId,
    documentTypeName: "card",
    limit,
  });
  const cards = normalizeCards(results);
  log?.(`Found ${cards.length} card(s) total.`);
  return cards;
}

export async function listMarketplaceCards({
  sdk,
  contractId,
  limit = 50,
  log,
}: BaseParams): Promise<Card[]> {
  log?.("Loading marketplace…");
  const results = await sdk.documents.query({
    dataContractId: contractId,
    documentTypeName: "card",
    limit,
  });
  const cards = normalizeCards(results).filter((c) => c.$price);
  log?.(`Found ${cards.length} card(s) for sale.`);
  return cards;
}
