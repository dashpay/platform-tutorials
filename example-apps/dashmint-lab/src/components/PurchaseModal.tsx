import { useState } from 'react'
import { purchaseCard } from '../dash/purchaseCard'
import type { Card } from '../dash/queries'
import { useSession } from '../session/useSession'
import { formatCredits } from '../lib/format'
import { Modal } from './Modal'
import { CardSummary } from './CardSummary'

export interface PurchaseModalProps {
  card: Card | null
  onClose: () => void
  onPurchased?: () => void
}

export function PurchaseModal({
  card,
  onClose,
  onPurchased,
}: PurchaseModalProps) {
  const session = useSession()
  const [submitting, setSubmitting] = useState(false)

  async function handleBuy() {
    if (
      !card ||
      !session.sdk ||
      !session.keyManager ||
      !session.contractId ||
      card.$price === undefined ||
      card.$price === null
    )
      return
    setSubmitting(true)
    try {
      await purchaseCard({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: session.contractId,
        cardId: card.id,
        price: card.$price,
        log: session.log,
      })
      onPurchased?.()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={!!card} title="Purchase card" onClose={onClose}>
      {card && (
        <div className="flex flex-col gap-4">
          <CardSummary card={card}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                Price
              </span>
              <span className="text-[13px] font-bold text-accent">
                {formatCredits(card.$price)} credits
              </span>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleBuy}
                disabled={submitting}
                className="flex-1 rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
              >
                {submitting ? 'Purchasing…' : 'Buy'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md border border-line bg-transparent px-4 py-2 text-[13px] font-medium text-ink-3 transition hover:border-line-2 hover:text-ink-2"
              >
                Cancel
              </button>
            </div>
          </CardSummary>
        </div>
      )}
    </Modal>
  )
}
