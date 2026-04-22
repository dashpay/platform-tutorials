/**
 * Rarity indicator: glowing dot + uppercase label.
 * Compact mode uses smaller sizes for tight contexts like the OddsTable.
 */
import type { Rarity } from '../lib/rarity'
import { rarityLabel } from '../lib/rarity'

interface RarityTagProps {
  rarity: Rarity
  compact?: boolean
}

const RARITY_COLORS: Record<Rarity, string> = {
  common: 'var(--color-rarity-common)',
  rare: 'var(--color-rarity-rare)',
  legendary: 'var(--color-rarity-legend)',
}

export function RarityTag({ rarity, compact }: RarityTagProps) {
  const color = RARITY_COLORS[rarity]
  const dotSize = compact ? 5 : 6
  const textSize = compact ? '9px' : '10px'

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="shrink-0 rounded-full"
        style={{
          width: dotSize,
          height: dotSize,
          background: color,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
      <span
        className="font-semibold uppercase"
        style={{
          fontSize: textSize,
          letterSpacing: '0.1em',
          color,
        }}
      >
        {rarityLabel(rarity)}
      </span>
    </span>
  )
}
