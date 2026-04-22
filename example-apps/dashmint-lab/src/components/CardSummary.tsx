import type { ReactNode } from 'react'
import type { Card } from '../dash/queries'
import { rarityOf, rarityLabel } from '../lib/rarity'
import { StatPair } from './StatPair'

export function CardSummary({ card, children }: { card: Card; children?: ReactNode }) {
  const { data } = card
  const atk = data.attack ?? 0
  const def = data.defense ?? 0
  const rarity = rarityOf(data.attack, data.defense)

  return (
    <div className="flex flex-col gap-2">
      <span
        className={`inline-block self-start rounded-full px-1.5 py-px text-[0.5rem] font-semibold uppercase tracking-wider ${
          rarity === 'legendary'
            ? 'bg-[oklch(28%_0.06_75)] text-rarity-legend'
            : rarity === 'rare'
            ? 'bg-[oklch(28%_0.06_230)] text-rarity-rare'
            : 'bg-surface-2 text-rarity-common'
        }`}
      >
        {rarityLabel(rarity)}
      </span>

      <h3 className="text-[15px] font-semibold leading-[1.25] tracking-[-0.01em] text-ink">
        {data.name ?? '?'}
      </h3>

      <StatPair atk={atk} def={def} />

      {children && <div className="mt-1 border-t border-line pt-3">{children}</div>}
    </div>
  )
}
