import { useEffect, useState, type FormEvent } from "react";
import { burnCard } from "../dash/burnCard";
import type { Card } from "../dash/queries";
import { useSession } from "../session/useSession";
import { Modal } from "./Modal";
import { CardSummary } from "./CardSummary";

export interface BurnModalProps {
  card: Card | null;
  onClose: () => void;
  onBurned?: () => void;
}

export function BurnModal({ card, onClose, onBurned }: BurnModalProps) {
  const session = useSession();
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setConfirmed(false);
  }, [card]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    if (!card || !session.sdk || !session.keyManager || !session.contractId)
      return;
    setSubmitting(true);
    try {
      await burnCard({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: session.contractId,
        cardId: card.id,
        log: session.log,
      });
      onBurned?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={!!card} title="Burn card" onClose={onClose}>
      {card && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <CardSummary card={card}>
            <p className="text-[13px] text-danger">
              {confirmed
                ? "Are you sure? This action is permanent."
                : "This will permanently destroy the card. This cannot be undone."}
            </p>

            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className={`flex-1 rounded-md px-4 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4 ${
                  confirmed
                    ? "bg-danger text-bg hover:bg-[oklch(72%_0.22_25)]"
                    : "bg-[oklch(28%_0.06_25)] text-danger hover:bg-[oklch(32%_0.08_25)]"
                }`}
              >
                {submitting
                  ? "Burning…"
                  : confirmed
                    ? "Confirm Burn"
                    : "Burn Card"}
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
        </form>
      )}
    </Modal>
  );
}
