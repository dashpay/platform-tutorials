import { useEffect, useState, type FormEvent } from "react";
import { setPrice } from "../dash/setPrice";
import type { Card } from "../dash/queries";
import { useSession } from "../session/useSession";
import { formatCredits } from "../lib/format";
import { Modal } from "./Modal";
import { CardSummary } from "./CardSummary";

export interface SetPriceModalProps {
  card: Card | null;
  onClose: () => void;
  onPriced?: () => void;
}

export function SetPriceModal({ card, onClose, onPriced }: SetPriceModalProps) {
  const session = useSession();
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (card) setAmount("");
  }, [card]);

  async function submitPrice(price: number | bigint) {
    if (!card || !session.sdk || !session.keyManager || !session.contractId)
      return;
    setSubmitting(true);
    try {
      await setPrice({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: session.contractId,
        cardId: card.id,
        price,
        log: session.log,
      });
      onPriced?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const n = parseInt(amount, 10);
    if (!Number.isFinite(n) || n < 1) return;
    await submitPrice(n);
  }

  const hasCurrentPrice =
    !!card && card.$price !== undefined && card.$price !== null;

  return (
    <Modal
      open={!!card}
      title={hasCurrentPrice ? "Change price" : "Set price"}
      onClose={onClose}
    >
      {card && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <CardSummary card={card}>
            {hasCurrentPrice && (
              <div className="mb-3 text-[12px] text-accent">
                Currently listed at {formatCredits(card.$price)} credits
              </div>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                Price
              </span>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter price (credits)"
                className="w-full rounded-md border border-line bg-bg px-3 py-2 text-[13px] text-ink outline-none transition focus:border-accent-dim"
              />
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={submitting || !amount.trim()}
                className="flex-1 rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
              >
                {submitting
                  ? "Saving…"
                  : hasCurrentPrice
                    ? "Update price"
                    : "List for sale"}
              </button>
              {hasCurrentPrice && (
                <button
                  type="button"
                  onClick={() => submitPrice(0)}
                  disabled={submitting}
                  className="flex-1 rounded-md border border-line-2 px-4 py-2 text-[13px] font-medium text-ink-2 transition hover:border-accent-dim hover:text-ink disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
                >
                  Remove from sale
                </button>
              )}
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
