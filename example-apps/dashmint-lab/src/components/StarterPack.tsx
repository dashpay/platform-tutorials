/**
 * "Starter Pack" — mint the three tutorial cards in one click.
 *
 * Matches the original HTML's mintStarterPack(): Fire Dragon, Stone Golem,
 * Shadow Fox, each with random attack/defense (1-10), minted sequentially.
 */
import { useState } from 'react'
import { errorMessage } from '../dash/logger'
import { mintCard } from '../dash/mintCard'
import { useSession } from '../session/useSession'

const STARTER_CARDS = [
  { name: 'Fire Dragon', description: 'A legendary beast from the volcanic plains' },
  { name: 'Stone Golem', description: 'An ancient guardian carved from living rock' },
  { name: 'Shadow Fox', description: 'A swift trickster that strikes from darkness' },
]

export interface StarterPackProps {
  contractId: string
  onMinted?: () => void
}

export function StarterPack({ contractId, onMinted }: StarterPackProps) {
  const session = useSession()
  const [submitting, setSubmitting] = useState(false)

  async function handleMint() {
    if (!session.sdk || !session.keyManager) return
    setSubmitting(true)
    session.log('Minting starter pack (3 cards)…')
    try {
      for (const card of STARTER_CARDS) {
        await mintCard({
          sdk: session.sdk,
          keyManager: session.keyManager,
          contractId,
          card,
          log: session.log,
        })
      }
      session.log('Starter pack minted!', 'success')
      onMinted?.()
    } catch (err) {
      session.log(
        `Starter pack error: ${errorMessage(err)}`,
        'error',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
        Starter Pack (mint 3 cards)
      </h2>
      <p className="text-[12.5px] text-ink-3">
        Mint the Fire Dragon, Stone Golem, and Shadow Fox from the tutorial
        outline.
      </p>
      <button
        type="button"
        onClick={handleMint}
        disabled={submitting}
        className="self-start rounded-md border border-line-2 px-4 py-2 text-[13px] font-semibold text-ink transition hover:border-accent-dim hover:text-ink disabled:cursor-not-allowed disabled:border-line disabled:text-ink-4"
      >
        {submitting ? 'Minting…' : 'Mint Starter Pack'}
      </button>
    </div>
  )
}
