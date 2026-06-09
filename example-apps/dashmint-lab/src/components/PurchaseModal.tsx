import { useEffect, useState } from "react";
import { purchaseCard } from "../dash/purchaseCard";
import { errorMessage } from "../dash/logger";
import type { Card } from "../dash/queries";
import { useSession } from "../session/useSession";
import { formatCredits } from "../lib/format";
import { Modal } from "./Modal";
import { CardSummary } from "./CardSummary";
import {
  OperationResultNotice,
  type OperationResult,
} from "./OperationResultNotice";

export interface PurchaseModalProps {
  card: Card | null;
  onClose: () => void;
  onPurchased?: () => void;
}

const SUCCESS_CLOSE_DELAY_MS = 700;

export function PurchaseModal({
  card,
  onClose,
  onPurchased,
}: PurchaseModalProps) {
  const session = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OperationResult | null>(null);

  const price = card?.$price ?? null;
  const insufficientCredits =
    session.balance !== null && price !== null && session.balance < price;

  useEffect(() => {
    if (card) {
      setResult(null);
      setSubmitting(false);
    }
  }, [card]);

  async function handleBuy() {
    if (
      !card ||
      !session.sdk ||
      !session.keyManager ||
      !session.contractId ||
      card.$price === undefined ||
      card.$price === null ||
      insufficientCredits
    )
      return;
    setSubmitting(true);
    setResult(null);
    try {
      await purchaseCard({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: session.contractId,
        cardId: card.id,
        price: card.$price,
        log: session.log,
      });
      setResult({ kind: "success", message: "Card purchased successfully." });
      window.setTimeout(() => {
        onPurchased?.();
        onClose();
      }, SUCCESS_CLOSE_DELAY_MS);
    } catch (err) {
      setResult({ kind: "error", message: errorMessage(err) });
    } finally {
      setSubmitting(false);
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

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                Your balance
              </span>
              <span className="text-[13px] font-bold text-ink-2">
                {session.balance === null
                  ? "—"
                  : `${formatCredits(session.balance)} credits`}
              </span>
            </div>

            {insufficientCredits && (
              <p className="rounded-md border border-[oklch(30%_0.08_25)] bg-[oklch(22%_0.04_25)] px-3 py-2 text-[12px] font-medium leading-[1.45] text-danger">
                Not enough credits to buy this card.
              </p>
            )}

            {result && <OperationResultNotice result={result} />}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleBuy}
                disabled={
                  submitting ||
                  insufficientCredits ||
                  result?.kind === "success"
                }
                className="flex-1 rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
              >
                {submitting
                  ? "Purchasing…"
                  : insufficientCredits
                    ? "Insufficient credits"
                    : "Buy"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting || result?.kind === "success"}
                className="flex-1 rounded-md border border-line bg-transparent px-4 py-2 text-[13px] font-medium text-ink-3 transition hover:border-line-2 hover:text-ink-2"
              >
                Cancel
              </button>
            </div>
          </CardSummary>
        </div>
      )}
    </Modal>
  );
}
