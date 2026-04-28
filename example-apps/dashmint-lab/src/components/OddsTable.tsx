/**
 * Rarity odds table for the mint form.
 * Shows the probability of each tier based on random ATK + DEF rolls.
 */
import { RarityTag } from "./RarityTag";

const ODDS = [
  { rarity: "legendary" as const, range: "ATK + DEF >= 15", pct: "21%" },
  { rarity: "rare" as const, range: "11 <= sum <= 14", pct: "34%" },
  { rarity: "common" as const, range: "sum <= 10", pct: "45%" },
];

export function OddsTable() {
  return (
    <div className="mx-auto max-w-xs rounded-lg border border-line bg-bg p-3">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
        Odds
      </div>
      <p className="mb-3 text-[11px] leading-[1.5] text-ink-4">
        Attack and Defense roll independently, 1&ndash;10. Rarity is derived
        client-side from their sum.
      </p>
      <div className="flex flex-col gap-1.5">
        {ODDS.map((row) => (
          <div
            key={row.rarity}
            className="grid grid-cols-[100px_1fr_auto] items-center gap-2"
          >
            <RarityTag rarity={row.rarity} compact />
            <span className="font-mono text-[11px] text-ink-4">
              {row.range}
            </span>
            <span className="font-mono text-[11px] font-medium text-ink-2">
              {row.pct}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
