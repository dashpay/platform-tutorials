import { useEffect, useState, type FormEvent } from "react";
import { transferCard } from "../dash/transferCard";
import { errorMessage } from "../dash/logger";
import type { Card } from "../dash/queries";
import { useSession } from "../session/useSession";
import { truncateId } from "../lib/format";
import { useDpnsName } from "../hooks/useDpnsName";
import { useResolvedRecipient } from "../hooks/useResolvedRecipient";
import { identityUrl } from "../lib/explorer";
import {
  classifyRecipientInput,
  type RecipientMode,
} from "../dash/classifyRecipientInput";
import { normalizeDpnsName } from "../dash/resolveRecipient";
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

function IdentityLink({ identityId }: { identityId: string }) {
  return (
    <a
      href={identityUrl(identityId)}
      target="_blank"
      rel="noreferrer noopener"
      className="underline decoration-dotted underline-offset-2 hover:text-accent"
      onClick={(e) => e.stopPropagation()}
    >
      {truncateId(identityId)}
    </a>
  );
}

export function TransferModal({
  card,
  onClose,
  onTransferred,
}: TransferModalProps) {
  const session = useSession();
  const [recipient, setRecipient] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OperationResult | null>(null);

  const trimmedRecipient = recipient.trim();
  const mode: RecipientMode = trimmedRecipient
    ? classifyRecipientInput(trimmedRecipient)
    : "invalid";

  // Forward lookup (name → id): active for name/ambiguous inputs.
  const resolved = useResolvedRecipient(
    session.sdk,
    mode === "name" || mode === "ambiguous" ? trimmedRecipient : null,
  );

  // Reverse lookup (id → name): active for ambiguous inputs whose name lookup
  // didn't resolve (input was probably a raw ID) so we still show the helpful
  // "✓ alice.dash" confirmation as before.
  const idForReverse =
    mode === "ambiguous" && resolved.status === "not-found"
      ? trimmedRecipient
      : null;
  const reverseName = useDpnsName(session.sdk, idForReverse);

  useEffect(() => {
    if (card) {
      setRecipient("");
      setResult(null);
    }
  }, [card]);

  const resolvedId =
    resolved.status === "resolved" ? resolved.identityId : null;
  // When the input is definitely a name, only allow submit if we have a
  // resolved identity ID. A successful-but-empty lookup (not-found) must
  // not fall through to "send the typed name as a raw ID".
  const nameBlocksSubmit = mode === "name" && resolved.status !== "resolved";
  const ambiguousResolving =
    mode === "ambiguous" && resolved.status === "resolving";
  const canSubmit =
    !!trimmedRecipient &&
    mode !== "invalid" &&
    !nameBlocksSubmit &&
    !ambiguousResolving;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!card || !session.sdk || !session.keyManager || !session.contractId)
      return;
    if (!canSubmit) return;
    // Prefer a resolved identity ID when the name lookup succeeded; otherwise
    // pass the trimmed input (ambiguous fallback, the SDK will reject an
    // invalid ID with a clear error).
    const recipientId = resolvedId ?? trimmedRecipient;
    setSubmitting(true);
    setResult(null);
    try {
      await transferCard({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: session.contractId,
        cardId: card.id,
        recipientId,
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
                Recipient identity or DPNS name
              </span>
              <input
                type="text"
                required
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                  if (result) setResult(null);
                }}
                placeholder="alice.dash or identity ID"
                className="rounded-md border border-line bg-bg px-3 py-2 font-mono text-[13px] text-ink outline-none transition focus:border-accent-dim"
              />
              <RecipientHint
                mode={mode}
                resolved={resolved}
                reverseName={reverseName}
                trimmed={trimmedRecipient}
              />
            </label>

            {trimmedRecipient && mode !== "invalid" && (
              <p className="mt-2 text-[11px] text-ink-3">
                Transferring &ldquo;
                <span className="text-ink">{card.data.name}</span>&rdquo; to{" "}
                <TransferTarget
                  mode={mode}
                  resolved={resolved}
                  reverseName={reverseName}
                  trimmed={trimmedRecipient}
                />
              </p>
            )}

            {result && <OperationResultNotice result={result} />}

            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={
                  submitting || result?.kind === "success" || !canSubmit
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

interface HintProps {
  mode: RecipientMode;
  resolved: ReturnType<typeof useResolvedRecipient>;
  reverseName: string | null;
  trimmed: string;
}

function RecipientHint({ mode, resolved, reverseName, trimmed }: HintProps) {
  if (!trimmed) return null;

  if (mode === "invalid") {
    return (
      <span className="text-[10px] text-rose-400">
        Enter an identity ID or DPNS name (letters, digits, and hyphens only).
      </span>
    );
  }

  if (resolved.status === "resolving") {
    return <span className="text-[10px] text-ink-4">Resolving…</span>;
  }

  if (resolved.status === "resolved") {
    return (
      <span className="text-[10px] text-ink-4">
        ✓ <IdentityLink identityId={resolved.identityId} />
      </span>
    );
  }

  if (mode === "name") {
    return (
      <span className="text-[10px] text-rose-400">
        No identity found for &ldquo;{normalizeDpnsName(trimmed)}&rdquo;.
      </span>
    );
  }

  // mode === "ambiguous" and resolved.status === "not-found" →
  // treat input as an identity ID; show the reverse-lookup hint if we got one.
  if (reverseName) {
    return <span className="text-[10px] text-ink-4">✓ {reverseName}.dash</span>;
  }

  return null;
}

function TransferTarget({ mode, resolved, reverseName, trimmed }: HintProps) {
  // Prefer the name → id direction: show "alice.dash (truncatedId)".
  if (resolved.status === "resolved") {
    return (
      <span className="text-accent">
        {normalizeDpnsName(trimmed)}{" "}
        <span className="text-ink-4">
          (<IdentityLink identityId={resolved.identityId} />)
        </span>
      </span>
    );
  }

  // ID mode via ambiguous fallback with a reverse-lookup name.
  if (mode === "ambiguous" && reverseName) {
    return (
      <span className="text-accent">
        {reverseName}.dash{" "}
        <span className="text-ink-4">
          (<IdentityLink identityId={trimmed} />)
        </span>
      </span>
    );
  }

  // Fall-through: no resolved ID, no reverse-lookup name. This happens for
  // ambiguous inputs (a pasted ID that DPNS doesn't recognize) — safe to
  // link as an identity — and for name-mode inputs while resolving or
  // not-found, where the typed string is not a valid identity ID.
  if (mode === "ambiguous") {
    return (
      <span className="text-accent">
        <IdentityLink identityId={trimmed} />
      </span>
    );
  }

  return <span className="text-accent">{truncateId(trimmed)}</span>;
}
