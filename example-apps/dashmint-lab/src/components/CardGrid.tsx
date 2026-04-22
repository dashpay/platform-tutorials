/**
 * Responsive grid of CardTile components, with empty state.
 */
import type { Card } from '../dash/queries'
import { CardTile, type CardTileProps } from './CardTile'

export interface CardGridProps extends Omit<CardTileProps, 'card'> {
  cards: Card[]
  emptyMessage?: string
}

export function CardGrid({
  cards,
  emptyMessage = 'No cards found.',
  ...tileProps
}: CardGridProps) {
  if (cards.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line px-6 py-12 text-center text-ink-4">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,250px)] justify-center gap-3.5">
      {cards.map((card) => (
        <CardTile key={card.id} card={card} {...tileProps} />
      ))}
    </div>
  )
}
