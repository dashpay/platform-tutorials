/**
 * Rarity tier derived client-side from a card's attack + defense total.
 *
 * This is NOT persisted on-chain — the card schema only stores the raw
 * stats. Changing the thresholds here doesn't require a contract migration.
 *
 * Thresholds match the original HTML tutorial (nft-collectibles.html):
 *   legendary   total >= 15
 *   rare        total 11-14
 *   common      total <= 10
 */
export type Rarity = 'common' | 'rare' | 'legendary';

export function rarityOf(attack: number | undefined, defense: number | undefined): Rarity {
  const total = (attack ?? 0) + (defense ?? 0);
  if (total >= 15) return 'legendary';
  if (total >= 11) return 'rare';
  return 'common';
}

export function rarityLabel(rarity: Rarity): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}
