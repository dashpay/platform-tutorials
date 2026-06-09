import { useEffect, useState, type FormEvent } from "react";
import { setPrice } from "../dash/setPrice";
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

export interface SetPriceModalProps {
  card: Card | null;
  onClose: () => void;
  onPriced?: () => void;
}

const SUCCESS_CLOSE_DELAY_MS = 700;
// TODO(dashpay/platform#3786): Remove this app-level cap after the SDK can
// safely serialize document prices above Number.MAX_SAFE_INTEGER.
export const MAX_PRICE_CREDITS = 1_000_000_000_000_000;
const MAX_PRICE_ERROR = `Price must be between 1 and ${formatCredits(MAX_PRICE_CREDITS)} credits.`;

export function SetPriceModal({ card, onClose, onPriced }: SetPriceModalProps) {
  const session = useSession();
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OperationResult | null>(null);

  useEffect(() => {
    if (card) {
      setAmount("");
      setResult(null);
    }
  }, [card]);

  async function submitPrice(price: number | bigint) {
    if (!card || !session.sdk || !session.keyManager || !session.contractId)
      return;
    setSubmitting(true);
    setResult(null);
    try {
      await setPrice({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: session.contractId,
        cardId: card.id,
        price,
        log: session.log,
      });
      setResult({
        kind: "success",
        message:
          price === 0 || price === 0n
            ? "Card removed from sale."
            : "Price updated successfully.",
      });
      window.setTimeout(() => {
        onPriced?.();
        onClose();
      }, SUCCESS_CLOSE_DELAY_MS);
    } catch (err) {
      setResult({ kind: "error", message: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = amount.trim();
    const n = Number(value);
    if (!/^\d+$/.test(value) || !Number.isFinite(n) || n < 1) return;
    if (n > MAX_PRICE_CREDITS) {
      setResult({ kind: "error", message: MAX_PRICE_ERROR });
      return;
    }
    await submitPrice(n);
  }

  const hasCurrentPrice = !!card && !!card.$price;

  return (
    <Modal
      open={!!card}
      title={hasCurrentPrice ? "Change price" : "Set price"}
      onClose={onClose}
    >
      {card && (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4"
        >
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
                max={MAX_PRICE_CREDITS}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (result) setResult(null);
                }}
                placeholder="Enter price (credits)"
                className="w-full rounded-md border border-line bg-bg px-3 py-2 text-[13px] text-ink outline-none transition focus:border-accent-dim"
              />
            </label>

            {result && <OperationResultNotice result={result} />}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={
                  submitting || result?.kind === "success" || !amount.trim()
                }
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
                  disabled={submitting || result?.kind === "success"}
                  className="flex-1 rounded-md border border-line-2 px-4 py-2 text-[13px] font-medium text-ink-2 transition hover:border-accent-dim hover:text-ink disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
                >
                  Remove from sale
                </button>
              )}
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
        </form>
      )}
    </Modal>
  );
}
