import { useEffect, useState, type FormEvent } from "react";

import {
  listAnchorsByChain,
  listAnchorsByOwner,
  type AnchorRecord,
} from "../dash/queries";
import { errorMessage } from "../dash/logger";
import { formatBytes, formatTimestamp, truncateId } from "../lib/format";
import { useSession } from "../session/useSession";
import { OperationResultNotice } from "./OperationResultNotice";

type HistoryMode = "my" | "chain";

interface HistoryPanelProps {
  contractId: string | null;
  refreshKey: number;
  requestedChainId?: string | null;
  requestToken?: number;
}

export function HistoryPanel({
  contractId,
  refreshKey,
  requestedChainId,
  requestToken = 0,
}: HistoryPanelProps) {
  const session = useSession();
  const [mode, setMode] = useState<HistoryMode>(
    session.status === "authenticated" ? "my" : "chain",
  );
  const [chainInput, setChainInput] = useState("");
  const [activeChainId, setActiveChainId] = useState("");
  const [anchors, setAnchors] = useState<AnchorRecord[]>([]);
  const [errorState, setErrorState] = useState<string | null>(null);
  const effectiveMode = session.status === "authenticated" ? mode : "chain";
  const canQueryOwner =
    effectiveMode === "my" &&
    !!session.sdk &&
    !!contractId &&
    !!session.identityId;
  const canQueryChain =
    effectiveMode === "chain" &&
    !!session.sdk &&
    !!contractId &&
    !!activeChainId.trim();

  useEffect(() => {
    const trimmed = requestedChainId?.trim();
    if (!trimmed) return;
    setMode("chain");
    setChainInput(trimmed);
    setActiveChainId(trimmed);
    setAnchors([]);
    setErrorState(null);
  }, [requestedChainId, requestToken]);

  useEffect(() => {
    if (canQueryOwner) {
      const sdk = session.sdk;
      const ownerId = session.identityId;
      if (!sdk || !contractId || !ownerId) return;
      let cancelled = false;
      void listAnchorsByOwner({
        sdk,
        contractId,
        ownerId,
        log: session.log,
      })
        .then((records) => {
          if (cancelled) return;
          setErrorState(null);
          setAnchors(records);
        })
        .catch((err) => {
          if (cancelled) return;
          setAnchors([]);
          setErrorState(errorMessage(err));
        });
      return () => {
        cancelled = true;
      };
    }

    if (!canQueryChain) return;
    const sdk = session.sdk;
    if (!sdk || !contractId) return;
    let cancelled = false;
    void listAnchorsByChain({
      sdk,
      contractId,
      chainId: activeChainId,
      log: session.log,
    })
      .then((records) => {
        if (cancelled) return;
        setErrorState(null);
        setAnchors(records);
      })
      .catch((err) => {
        if (cancelled) return;
        setAnchors([]);
        setErrorState(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [
    canQueryOwner,
    canQueryChain,
    contractId,
    activeChainId,
    session.identityId,
    session.log,
    session.sdk,
    refreshKey,
  ]);

  const emptyMessage = !contractId
    ? "Set a contract ID to query history."
    : effectiveMode === "my" && !session.identityId
        ? "Login to load owner history."
      : effectiveMode === "chain" && !activeChainId.trim()
        ? "Enter a chain ID to query its history."
        : anchors.length === 0 && !errorState
          ? effectiveMode === "my"
            ? "No anchors found for this identity."
            : "No anchors found for that chain."
          : null;

  function handleChainSubmit(event: FormEvent) {
    event.preventDefault();
    setActiveChainId(chainInput.trim());
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
            History
          </div>
          <h2 className="mt-2 text-[18px] font-semibold tracking-tight text-ink">
            Review owner and chain timelines
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={session.status !== "authenticated"}
            onClick={() => setMode("my")}
            className={`rounded-md border px-3 py-2 text-[12px] font-semibold transition ${
              effectiveMode === "my"
                ? "border-accent bg-accent text-bg"
                : "border-line bg-bg text-ink-2"
            } disabled:cursor-not-allowed disabled:border-line disabled:bg-surface disabled:text-ink-4`}
          >
            My anchors
          </button>
          <button
            type="button"
            onClick={() => setMode("chain")}
            className={`rounded-md border px-3 py-2 text-[12px] font-semibold transition ${
              effectiveMode === "chain"
                ? "border-accent bg-accent text-bg"
                : "border-line bg-bg text-ink-2"
            }`}
          >
            By chain
          </button>
        </div>
      </div>

      {effectiveMode === "chain" && (
        <form onSubmit={handleChainSubmit} className="mt-5 flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={chainInput}
            onChange={(event) => setChainInput(event.target.value)}
            placeholder="invoice-2026-04"
            className="flex-1 rounded-md border border-line bg-bg px-3 py-2 text-[13px] text-ink outline-none transition focus:border-accent-dim"
          />
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition hover:bg-accent-dim"
          >
            Load chain
          </button>
        </form>
      )}

      {(errorState || emptyMessage) && (
        <div className="mt-5">
          <OperationResultNotice
            tone={errorState ? "error" : "info"}
            title="History status"
          >
            {errorState ?? emptyMessage}
          </OperationResultNotice>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {anchors.map((anchor) => (
          <article
            key={anchor.id}
            className="rounded-lg border border-line bg-bg px-5 py-4"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                  Chain
                </div>
                <div className="mt-1 text-lg font-semibold text-ink">
                  {anchor.chainId}
                </div>
                <div className="mt-2 font-mono text-[12px] leading-6 text-ink-2">
                  {anchor.entryHashHex}
                </div>
              </div>
              <div className="grid gap-3 text-sm text-ink-2 sm:grid-cols-2 md:min-w-[330px]">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                    Anchored at
                  </div>
                  <div className="mt-1">{formatTimestamp(anchor.createdAt)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                    Owner
                  </div>
                  <div className="mt-1 font-mono text-[12px]">
                    {truncateId(anchor.ownerId, 12)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                    File
                  </div>
                  <div className="mt-1">{anchor.filename ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                    Size
                  </div>
                  <div className="mt-1">{formatBytes(anchor.size)}</div>
                </div>
              </div>
            </div>
            {anchor.note && (
              <p className="mt-3 text-sm leading-6 text-ink-2">{anchor.note}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
