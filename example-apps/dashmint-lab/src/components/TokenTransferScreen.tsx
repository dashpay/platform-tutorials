import { useState, type FormEvent } from "react";
import {
  classifyRecipientInput,
  type RecipientMode,
} from "../dash/classifyRecipientInput";
import {
  DASHMINT_TOKEN_NAME,
  DASHMINT_TOKEN_PLURAL,
} from "../dash/dashMintToken";
import { errorMessage } from "../dash/logger";
import { normalizeDpnsName } from "../dash/resolveRecipient";
import { transferDashMintTokens } from "../dash/transferDashMintTokens";
import { useDpnsName } from "../hooks/useDpnsName";
import { useResolvedRecipient } from "../hooks/useResolvedRecipient";
import { truncateId } from "../lib/format";
import { useSession } from "../session/useSession";
import { IdentityLink } from "./IdentityLink";
import {
  OperationResultNotice,
  type OperationResult,
} from "./OperationResultNotice";

export interface TokenTransferScreenProps {
  contractId: string;
  dashMintTokenBalance?: bigint | null;
  onTransferred?: () => void;
}

export function TokenTransferScreen({
  contractId,
  dashMintTokenBalance = null,
  onTransferred,
}: TokenTransferScreenProps) {
  const session = useSession();
  const [recipient, setRecipient] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OperationResult | null>(null);

  const trimmedRecipient = recipient.trim();
  const recipientMode: RecipientMode = trimmedRecipient
    ? classifyRecipientInput(trimmedRecipient)
    : "invalid";
  const resolved = useResolvedRecipient(
    session.sdk,
    recipientMode === "name" || recipientMode === "ambiguous"
      ? trimmedRecipient
      : null,
  );
  const idForReverse =
    recipientMode === "ambiguous" && resolved.status === "not-found"
      ? trimmedRecipient
      : null;
  const reverseName = useDpnsName(session.sdk, idForReverse);

  const amount = parseWholeTokenAmount(amountInput);
  const amountError = amountInput.trim()
    ? amount === null
      ? "Enter a positive whole amount."
      : dashMintTokenBalance !== null && amount > dashMintTokenBalance
        ? `Insufficient ${DASHMINT_TOKEN_NAME} balance.`
        : null
    : null;
  const resolvedId =
    resolved.status === "resolved" ? resolved.identityId : null;
  const nameBlocksSubmit =
    recipientMode === "name" && resolved.status !== "resolved";
  const ambiguousResolving =
    recipientMode === "ambiguous" && resolved.status === "resolving";
  const canSubmit =
    !!session.sdk &&
    !!session.keyManager &&
    !!trimmedRecipient &&
    recipientMode !== "invalid" &&
    amount !== null &&
    amountError === null &&
    !nameBlocksSubmit &&
    !ambiguousResolving;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session.sdk || !session.keyManager || !canSubmit || amount === null) {
      return;
    }

    const recipientId = resolvedId ?? trimmedRecipient;
    setSubmitting(true);
    setResult(null);
    try {
      await transferDashMintTokens({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId,
        recipientId,
        amount,
        availableBalance: dashMintTokenBalance,
        log: session.log,
      });
      setResult({
        kind: "success",
        message: `${DASHMINT_TOKEN_NAME} tokens transferred successfully.`,
      });
      setRecipient("");
      setAmountInput("");
      onTransferred?.();
    } catch (err) {
      setResult({ kind: "error", message: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-[900px] gap-5 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <div className="rounded-lg border border-line bg-surface p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
          Your {DASHMINT_TOKEN_NAME} balance
        </div>
        <div className="mt-2 font-mono text-[30px] font-semibold leading-none text-ink">
          {dashMintTokenBalance === null
            ? "Unavailable"
            : dashMintTokenBalance.toString()}
        </div>
        <p className="mt-3 text-[12px] leading-[1.55] text-ink-3">
          {DASHMINT_TOKEN_PLURAL} tokens are spent to mint cards and can be sent
          to another identity on the active testnet contract.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
      >
        <div>
          <h2 className="text-[14px] font-semibold text-ink">
            Transfer tokens
          </h2>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
            Amount
          </span>
          <input
            type="text"
            inputMode="numeric"
            required
            value={amountInput}
            onChange={(e) => {
              setAmountInput(e.target.value);
              if (result) setResult(null);
            }}
            placeholder="1"
            className="h-9 rounded-md border border-line bg-bg px-3 font-mono text-[13px] text-ink outline-none transition focus:border-accent-dim"
          />
          {amountError && (
            <span className="text-[10px] text-rose-400">{amountError}</span>
          )}
        </label>

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
            className="h-9 rounded-md border border-line bg-bg px-3 font-mono text-[13px] text-ink outline-none transition focus:border-accent-dim"
          />
          <RecipientHint
            mode={recipientMode}
            resolved={resolved}
            reverseName={reverseName}
            trimmed={trimmedRecipient}
          />
        </label>

        {trimmedRecipient && recipientMode !== "invalid" && amount !== null && (
          <p className="text-[11px] text-ink-3">
            Sending{" "}
            <span className="font-mono text-ink">{amount.toString()}</span>{" "}
            {DASHMINT_TOKEN_PLURAL} to{" "}
            <TransferTarget
              mode={recipientMode}
              resolved={resolved}
              reverseName={reverseName}
              trimmed={trimmedRecipient}
            />
          </p>
        )}

        {result && <OperationResultNotice result={result} />}

        <div className="mt-1 flex gap-2">
          <button
            type="submit"
            disabled={submitting || result?.kind === "success" || !canSubmit}
            className="flex-1 rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
          >
            {submitting ? "Transferring..." : "Transfer"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setRecipient("");
              setAmountInput("");
              setResult(null);
            }}
            className="flex-1 rounded-md border border-line bg-transparent px-4 py-2 text-[13px] font-medium text-ink-3 transition hover:border-line-2 hover:text-ink-2 disabled:cursor-not-allowed disabled:text-ink-4"
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}

function parseWholeTokenAmount(input: string): bigint | null {
  const trimmed = input.trim();
  if (!/^[0-9]+$/.test(trimmed)) return null;
  const amount = BigInt(trimmed);
  return amount > 0n ? amount : null;
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
        Enter an identity ID or DPNS name.
      </span>
    );
  }

  if (resolved.status === "resolving") {
    return <span className="text-[10px] text-ink-4">Resolving...</span>;
  }

  if (resolved.status === "resolved") {
    return (
      <span className="text-[10px] text-ink-4">
        Resolved <IdentityLink identityId={resolved.identityId} />
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

  if (reverseName) {
    return (
      <span className="text-[10px] text-ink-4">
        Resolved {reverseName}.dash
      </span>
    );
  }

  return null;
}

function TransferTarget({ mode, resolved, reverseName, trimmed }: HintProps) {
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

  if (mode === "ambiguous") {
    return (
      <span className="text-accent">
        <IdentityLink identityId={trimmed} />
      </span>
    );
  }

  return <span className="text-accent">{truncateId(trimmed)}</span>;
}
