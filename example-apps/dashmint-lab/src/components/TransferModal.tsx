import { useEffect, useState, type FormEvent } from "react";
import { transferCard } from "../dash/transferCard";
import { errorMessage } from "../dash/logger";
import type { Card } from "../dash/queries";
import { useSession } from "../session/useSession";
import { truncateId } from "../lib/format";
import { useDpnsName } from "../hooks/useDpnsName";
import { Modal } from "./Modal";
import { CardSummary } from "./CardSummary";
import {
  OperationResultNotice,
  type OperationResult,
} from "./OperationResultNotice";

export interface TransferModalProps {
  card: Card | null;
  onClose: () => void;
  onTransferred?: () => void;
}

const SUCCESS_CLOSE_DELAY_MS = 700;

export function TransferModal({
  card,
  onClose,
  onTransferred,
}: TransferModalProps) {
  const session = useSession();
  const [recipient, setRecipient] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OperationResult | null>(null);
  // Resolve DPNS name once the input looks like a valid identity ID (32+ chars, base58).
  const trimmedRecipient = recipient.trim();
  const recipientName = useDpnsName(
    session.sdk,
    trimmedRecipient.length >= 32 ? trimmedRecipient : null,
  );

  useEffect(() => {
    if (card) {
      setRecipient("");
      setResult(null);
    }
  }, [card]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!card || !session.sdk || !session.keyManager || !session.contractId)
      return;
    setSubmitting(true);
    setResult(null);
    try {
      await transferCard({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: session.contractId,
        cardId: card.id,
        recipientId: recipient.trim(),
        log: session.log,
      });
      setResult({ kind: "success", message: "Card transferred successfully." });
      window.setTimeout(() => {
        onTransferred?.();
        onClose();
      }, SUCCESS_CLOSE_DELAY_MS);
    } catch (err) {
      setResult({ kind: "error", message: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={!!card} title="Transfer card" onClose={onClose}>
      {card && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <CardSummary card={card}>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                Recipient identity ID
              </span>
              <input
                type="text"
                required
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                  if (result) setResult(null);
                }}
                placeholder="Identity ID of the recipient"
                className="rounded-md border border-line bg-bg px-3 py-2 font-mono text-[13px] text-ink outline-none transition focus:border-accent-dim"
              />
              {recipientName && (
                <span className="text-[10px] text-ink-4">
                  ✓ {recipientName}.dash
                </span>
              )}
            </label>

            {trimmedRecipient && (
              <p className="mt-2 text-[11px] text-ink-3">
                Transferring &ldquo;
                <span className="text-ink">{card.data.name}</span>&rdquo; to{" "}
                <span className="text-accent">
                  {recipientName ? (
                    <>
                      {recipientName}.dash{" "}
                      <span className="text-ink-4">
                        ({truncateId(trimmedRecipient)})
                      </span>
                    </>
                  ) : (
                    truncateId(trimmedRecipient)
                  )}
                </span>
              </p>
            )}

            {result && <OperationResultNotice result={result} />}

            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={
                  submitting || result?.kind === "success" || !recipient.trim()
                }
                className="flex-1 rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
              >
                {submitting ? "Transferring…" : "Transfer"}
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
        </form>
      )}
    </Modal>
  );
}
