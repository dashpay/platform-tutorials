import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  listAnchorsByChain,
  listAnchorsByOwner,
  type AnchorRecord,
} from "../dash/queries";
import { errorMessage } from "../dash/logger";
import {
  formatBytes,
  formatCompactTimestamp,
  formatRelativeTime,
  formatTimespan,
  shortMimeLabel,
  truncateId,
} from "../lib/format";
import { useSession } from "../session/useSession";
import { CopyButton } from "./CopyButton";
import { OperationResultNotice } from "./OperationResultNotice";

type HistoryMode = "my" | "chain";

interface HistoryPanelProps {
  contractId: string | null;
  refreshKey: number;
  requestedChainId?: string | null;
  requestToken?: number;
}

const EXPLORER_BASE = "https://testnet.platform-explorer.com";
const documentUrl = (id: string) => `${EXPLORER_BASE}/document/${id}`;

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
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prevRequestToken, setPrevRequestToken] = useState<number | undefined>(
    undefined,
  );

  // Reset state in response to a new parent-issued request (monotonic
  // requestToken). React docs recommend doing this during render rather than
  // in an effect — see https://react.dev/learn/you-might-not-need-an-effect.
  // The sentinel-undefined initial value ensures the reset fires on first
  // render too (the parent mounts this panel fresh with the token already
  // bumped).
  if (prevRequestToken !== requestToken) {
    setPrevRequestToken(requestToken);
    const trimmed = requestedChainId?.trim();
    if (trimmed) {
      setMode("chain");
      setChainInput(trimmed);
      setActiveChainId(trimmed);
      setAnchors([]);
      setErrorState(null);
    }
  }

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

  function showToast(label: string) {
    setToast(`${label} copied`);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

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

  const groupedAnchors = useMemo(() => {
    // Group by chainId regardless of input order. The "by owner" mode sorts by
    // $createdAt, so same-chain anchors can be split across the list — a
    // sequential reduce would emit duplicate groups in that case.
    const byChain = new Map<string, AnchorRecord[]>();
    for (const anchor of anchors) {
      const existing = byChain.get(anchor.chainId);
      if (existing) {
        existing.push(anchor);
      } else {
        byChain.set(anchor.chainId, [anchor]);
      }
    }
    return Array.from(byChain, ([chainId, items]) => ({ chainId, items }));
  }, [anchors]);

  const myStats = useMemo(() => {
    if (effectiveMode !== "my") return null;
    return {
      total: anchors.length,
      chains: groupedAnchors.length,
    };
  }, [effectiveMode, anchors.length, groupedAnchors.length]);

  function openChainHistory(chainId: string) {
    const trimmed = chainId.trim();
    if (!trimmed) return;
    setMode("chain");
    setChainInput(trimmed);
    setActiveChainId(trimmed);
    setErrorState(null);
  }

  function handleChainSubmit(event: FormEvent) {
    event.preventDefault();
    setActiveChainId(chainInput.trim());
  }

  return (
    <section className="mx-auto max-w-[1000px] rounded-xl border border-line bg-surface p-5 md:p-6">
      <Header
        mode={effectiveMode}
        canSwitchToMy={session.status === "authenticated"}
        myCount={effectiveMode === "my" ? anchors.length : undefined}
        onModeChange={setMode}
      />

      {effectiveMode === "chain" && (
        <ChainSearchForm
          value={chainInput}
          onChange={setChainInput}
          onSubmit={handleChainSubmit}
        />
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

      {!errorState && !emptyMessage && (
        <div className="mt-5">
          {effectiveMode === "my" && myStats ? (
            <SectionSummary
              left={
                <span className="text-[13px] text-ink-2">
                  <strong className="font-semibold text-ink">
                    {myStats.total}
                  </strong>{" "}
                  proof{myStats.total === 1 ? "" : "s"} across{" "}
                  <strong className="font-semibold text-ink">
                    {myStats.chains}
                  </strong>{" "}
                  chain{myStats.chains === 1 ? "" : "s"}
                </span>
              }
              right={
                <span className="text-[12px] text-ink-4">Newest first</span>
              }
            />
          ) : effectiveMode === "chain" ? (
            <SectionSummary
              left={
                <span className="text-[13px] text-ink-2">
                  <strong className="font-semibold text-ink">
                    {anchors.length}
                  </strong>{" "}
                  proof{anchors.length === 1 ? "" : "s"} in this chain
                </span>
              }
              right={
                <span className="text-[12px] text-ink-4">Latest at top</span>
              }
            />
          ) : null}

          <div className="flex flex-col gap-3.5">
            {effectiveMode === "my" ? (
              groupedAnchors.map((group) =>
                group.items.length === 1 ? (
                  <AnchorCard
                    key={group.items[0].id}
                    anchor={group.items[0]}
                    onChainClick={openChainHistory}
                    onCopied={showToast}
                  />
                ) : (
                  <ChainBlock
                    key={group.chainId}
                    chainId={group.chainId}
                    items={group.items}
                    onCopied={showToast}
                    onChainClick={openChainHistory}
                  />
                ),
              )
            ) : (
              <ChainBlock
                chainId={activeChainId}
                items={[...anchors].sort(
                  (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
                )}
                onCopied={showToast}
                onChainClick={openChainHistory}
              />
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast} />}
    </section>
  );
}

interface HeaderProps {
  mode: HistoryMode;
  canSwitchToMy: boolean;
  myCount?: number;
  onModeChange: (mode: HistoryMode) => void;
}

function Header({ mode, canSwitchToMy, myCount, onModeChange }: HeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
          History
        </div>
        <h2 className="mt-2 text-[22px] leading-tight font-semibold tracking-tight text-ink">
          Review owner and chain timelines
        </h2>
        <p className="mt-1.5 max-w-[60ch] text-[13px] text-ink-3">
          Every anchor is immutable - these are read-only snapshots from Dash
          Platform. Open a chain to follow it through time.
        </p>
      </div>

      <div
        role="tablist"
        className="inline-flex shrink-0 gap-0.5 rounded-lg border border-line bg-bg p-[3px]"
      >
        <SegmentedTab
          active={mode === "my"}
          disabled={!canSwitchToMy}
          onClick={() => onModeChange("my")}
          label="My anchors"
          count={myCount}
        />
        <SegmentedTab
          active={mode === "chain"}
          onClick={() => onModeChange("chain")}
          label="By chain"
        />
      </div>
    </div>
  );
}

interface SegmentedTabProps {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}

function SegmentedTab({
  active,
  disabled,
  onClick,
  label,
  count,
}: SegmentedTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-[30px] items-center gap-1.5 rounded-md px-3.5 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:text-ink-4 ${
        active
          ? "bg-surface-2 text-ink"
          : "bg-transparent text-ink-3 hover:text-ink-2"
      }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`rounded-full px-1.5 font-mono text-[10.5px] font-medium ${
            active ? "bg-bg text-ink-3" : "text-ink-4"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

interface ChainSearchFormProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: (event: FormEvent) => void;
}

function ChainSearchForm({ value, onChange, onSubmit }: ChainSearchFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-5 flex flex-wrap gap-2">
      <div className="relative flex min-w-[240px] flex-1 items-center">
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="pointer-events-none absolute left-3 text-ink-4"
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L13.5 13.5" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="invoice-2026-04"
          className="h-9 w-full rounded-md border border-line bg-bg pl-8 pr-3 font-mono text-[13px] text-ink outline-none transition focus:border-accent-dim"
        />
      </div>
      <button
        type="submit"
        className="h-9 shrink-0 rounded-md bg-accent px-4 text-[13px] font-semibold text-bg transition hover:bg-accent-dim"
      >
        Load chain
      </button>
    </form>
  );
}

function FactsValue({
  children,
  mono,
  align = "left",
}: {
  children: ReactNode;
  mono?: boolean;
  align?: "left" | "right";
}) {
  return (
    <span
      className={`block text-[13px] leading-[1.35] text-ink-2 ${
        mono ? "font-mono" : ""
      } ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </span>
  );
}

function TypeChip({ mime }: { mime?: string }) {
  return (
    <span className="inline-flex h-5 items-center rounded border border-line bg-surface-2 px-1.5 font-mono text-[10.5px] font-semibold tracking-wider text-ink-3">
      {shortMimeLabel(mime)}
    </span>
  );
}

interface IdFieldProps {
  label: string;
  value: string;
  href?: string;
  onCopied?: (label: string) => void;
}

function IdField({ label, value, href, onCopied }: IdFieldProps) {
  const display = truncateId(value, 8);
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-line bg-bg px-3 py-2">
      <span className="min-w-[56px] shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-4">
        {label}
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink-2 transition hover:text-accent"
          title={value}
        >
          {display}
        </a>
      ) : (
        <span
          className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink-2"
          title={value}
        >
          {display}
        </span>
      )}
      <CopyButton value={value} label={label} onCopied={onCopied} />
    </div>
  );
}

function FileHeader({ anchor }: { anchor: AnchorRecord }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:gap-3">
      <div className="min-w-0 flex-1 self-stretch">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 break-all text-[17px] leading-tight font-semibold tracking-tight text-ink">
            {anchor.filename ?? anchor.chainId}
          </h3>
          <TypeChip mime={anchor.mimeType} />
        </div>
        {anchor.note && (
          <p className="mt-1.5 max-w-[60ch] text-[13px] leading-[1.5] text-ink-3">
            {anchor.note}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-row items-baseline gap-x-2 gap-y-[2px] text-left sm:flex-col sm:items-end sm:text-right">
        <span className="text-[12.5px] font-medium text-ink-2">
          {formatRelativeTime(anchor.createdAt)}
        </span>
        <span className="text-[11px] text-ink-4">
          {formatCompactTimestamp(anchor.createdAt)}
        </span>
      </div>
    </div>
  );
}

function FactsRow({
  anchor,
  onChainClick,
}: {
  anchor: AnchorRecord;
  onChainClick: (chainId: string) => void;
}) {
  return (
    <div className="mt-3.5 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-[3px] sm:gap-x-6">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-4">
        Size
      </span>
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-4">
        Chain
      </span>
      <span className="justify-self-end text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-4">
        Owner
      </span>

      <FactsValue>{formatBytes(anchor.size)}</FactsValue>
      <button
        type="button"
        onClick={() => onChainClick(anchor.chainId)}
        className="m-0 block w-full min-w-0 appearance-none border-0 bg-transparent p-0 text-left transition hover:text-accent"
      >
        <span
          className="block truncate text-[13px] leading-[1.35] text-ink-2 underline decoration-line-2 underline-offset-[3px] hover:decoration-accent-dim"
          title={anchor.chainId}
        >
          {anchor.chainId}
        </span>
      </button>
      <FactsValue mono align="right">
        {truncateId(anchor.ownerId, 6)}
      </FactsValue>
    </div>
  );
}

function IdRow({
  anchor,
  onCopied,
}: {
  anchor: AnchorRecord;
  onCopied: (label: string) => void;
}) {
  return (
    <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
      <IdField
        label="Hash (SHA-256)"
        value={anchor.entryHashHex}
        onCopied={onCopied}
      />
      <IdField
        label="Document ID"
        value={anchor.id}
        href={documentUrl(anchor.id)}
        onCopied={onCopied}
      />
    </div>
  );
}

function AnchorCard({
  anchor,
  onChainClick,
  onCopied,
}: {
  anchor: AnchorRecord;
  onChainClick: (chainId: string) => void;
  onCopied: (label: string) => void;
}) {
  return (
    <article className="rounded-xl border border-line bg-surface px-5 py-[18px] transition hover:border-line-2">
      <FileHeader anchor={anchor} />
      <FactsRow anchor={anchor} onChainClick={onChainClick} />
      <IdRow anchor={anchor} onCopied={onCopied} />
    </article>
  );
}

function ChainBlock({
  chainId,
  items,
  onCopied,
  onChainClick,
}: {
  chainId: string;
  items: AnchorRecord[];
  onCopied: (label: string) => void;
  onChainClick: (chainId: string) => void;
}) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [items],
  );
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <ChainHeader chainId={chainId} items={items} onCopied={onCopied} />
      <div>
        {sorted.map((anchor, i) => (
          <div
            key={anchor.id}
            className={i === 0 ? "" : "border-t border-line"}
          >
            <TimelineRow
              anchor={anchor}
              isFirst={i === 0}
              isLast={i === sorted.length - 1}
              isLatest={i === 0}
              onCopied={onCopied}
              onChainClick={onChainClick}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function ChainHeader({
  chainId,
  items,
  onCopied,
}: {
  chainId: string;
  items: AnchorRecord[];
  onCopied: (label: string) => void;
}) {
  const totalSize = items.reduce((s, a) => s + (a.size ?? 0), 0);
  const sorted = [...items].sort(
    (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span =
    items.length > 1 && first.createdAt && last.createdAt
      ? formatTimespan(last.createdAt - first.createdAt)
      : "—";
  return (
    <div className="flex items-start gap-4 border-b border-line bg-surface-2 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-4">
          Chain
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2.5">
          <div className="break-all font-mono text-[14px] font-medium text-ink">
            {chainId}
          </div>
          <CopyButton value={chainId} label="Chain" onCopied={onCopied} />
        </div>
      </div>
      <div className="flex shrink-0 gap-5 pt-[2px]">
        <ChainStat label="Proofs" value={items.length} />
        <ChainStat label="Total" value={formatBytes(totalSize)} />
        <ChainStat label="Span" value={span} />
      </div>
    </div>
  );
}

function ChainStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="text-right">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-4">
        {label}
      </div>
      <div className="mt-[3px] text-[14px] font-medium text-ink-2">{value}</div>
    </div>
  );
}

function TimelineRow({
  anchor,
  isFirst,
  isLast,
  isLatest,
  onCopied,
  onChainClick,
}: {
  anchor: AnchorRecord;
  isFirst: boolean;
  isLast: boolean;
  isLatest: boolean;
  onCopied: (label: string) => void;
  onChainClick: (chainId: string) => void;
}) {
  return (
    <div className="relative grid grid-cols-[44px_1fr] py-[18px] pr-5">
      <div className="relative">
        <div
          className="absolute left-[21px] w-px bg-line"
          style={{
            top: isFirst ? 26 : 0,
            bottom: isLast ? "calc(100% - 26px)" : 0,
          }}
        />
        <div
          className="absolute left-[14px] top-[18px] h-[14px] w-[14px] rounded-full"
          style={{
            background: isLatest
              ? "var(--color-accent)"
              : "var(--color-surface)",
            border: `2px solid ${
              isLatest ? "var(--color-accent)" : "var(--color-line-2)"
            }`,
            boxShadow: isLatest ? "0 0 0 4px rgb(0 141 228 / 0.12)" : "none",
          }}
        />
      </div>

      <div className="min-w-0">
        <FileHeader anchor={anchor} />
        <FactsRow anchor={anchor} onChainClick={onChainClick} />
        <IdRow anchor={anchor} onCopied={onCopied} />
      </div>
    </div>
  );
}

function SectionSummary({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between border-b border-dashed border-line pb-2.5">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-line-2 bg-surface-2 px-3.5 py-2 text-[12.5px] text-ink shadow-lg"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 8.5l3.2 3 6.8-7" />
      </svg>
      {message}
    </div>
  );
}
