import { useEffect, useState } from "react";

import type { NoteRecord } from "../dash/queries";
import { FIELD_BYTE_LIMIT } from "../lib/fieldLimits";
import { formatRelativeTime, formatTimestamp } from "../lib/format";
import { MobileActionSheet } from "./MobileActionSheet";
import { NoteJsonDrawer } from "./NoteJsonDrawer";
import { OperationResultNotice } from "./OperationResultNotice";

interface NoteEditorProps {
  selectedId: string | "new" | null;
  note: NoteRecord | null;
  title: string;
  message: string;
  onTitleChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onBack: () => void;
  loading: boolean;
  saving: boolean;
  deleting: boolean;
  canEdit: boolean;
  canDelete: boolean;
  dirty: boolean;
  messageBytes: number;
  messageOversize: boolean;
  contractReady: boolean;
  contractId: string | null;
  error: string | null;
  conflictWarning?: string | null;
  onOpenLogin: () => void;
  onOpenSettings: () => void;
  isReadOnly?: boolean;
  isDesktop: boolean;
}

export function NoteEditor({
  selectedId,
  note,
  title,
  message,
  onTitleChange,
  onMessageChange,
  onSave,
  onDelete,
  onBack,
  loading,
  saving,
  deleting,
  canEdit,
  canDelete,
  dirty,
  messageBytes,
  messageOversize,
  contractReady,
  contractId,
  error,
  conflictWarning,
  onOpenLogin,
  onOpenSettings,
  isReadOnly = false,
  isDesktop,
}: NoteEditorProps) {
  const hasSelection = selectedId !== null;
  const isNew = selectedId === "new";
  const oversize = messageOversize;
  const [jsonOpen, setJsonOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);
  const showMobileSave =
    !isDesktop && !isReadOnly && hasSelection && (dirty || saving);
  const mobileHeaderStatus =
    !isDesktop && hasSelection
      ? dirty
        ? "Edited"
        : note && !isNew
          ? `Updated ${formatRelativeTime(note.updatedAt)}`
          : null
      : null;

  // Cmd/Ctrl-S triggers Save (matches the keyboard hint chip).
  useEffect(() => {
    if (!isDesktop || isReadOnly || !hasSelection) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!canEdit || saving || !dirty || oversize) return;
        onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    isDesktop,
    isReadOnly,
    hasSelection,
    canEdit,
    saving,
    dirty,
    oversize,
    onSave,
  ]);

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-line bg-surface shadow-[0_20px_60px_-36px_rgba(0,0,0,0.45)] max-md:rounded-none max-md:border-0 max-md:shadow-none md:h-full md:rounded-none md:border-0 md:bg-transparent md:shadow-none">
      <div className="flex h-[61px] min-w-0 items-center justify-between gap-3 overflow-hidden border-b border-line px-4 py-3 max-md:h-auto max-md:px-3 max-md:py-2.5">
        {hasSelection && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to notes"
            className="-ml-1 flex shrink-0 items-center gap-0.5 rounded-full pl-1 pr-2 py-1 text-[15px] font-medium text-accent transition hover:bg-surface-2 md:hidden"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span>Notes</span>
          </button>
        )}
        {isDesktop && (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {!hasSelection ? (
              <div className="text-[14px] text-ink-4">
                Select a note from the list
              </div>
            ) : loading && !note && !isNew ? (
              <div className="inline-flex items-center gap-2 text-[14px] text-ink-4">
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
                />
                Loading…
              </div>
            ) : note ? (
              <>
                <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[color:color-mix(in_oklab,var(--color-accent)_14%,transparent)] px-2.5 py-1 font-mono text-[11px] font-semibold text-accent max-lg:hidden">
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  Revision {note.revision}
                </span>
                {note.updatedAt && (
                  <span
                    title={formatTimestamp(note.updatedAt)}
                    className="min-w-0 truncate text-[12px] text-ink-4 max-lg:hidden"
                  >
                    Updated {formatRelativeTime(note.updatedAt)}
                  </span>
                )}
              </>
            ) : null}
          </div>
        )}
        <div className="min-w-0 flex-1 text-center md:hidden">
          {mobileHeaderStatus && (
            <span className="block truncate text-[12px] font-medium text-ink-4">
              {mobileHeaderStatus}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isDesktop && note && (
            <button
              type="button"
              onClick={() => setJsonOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11.5px] font-medium text-ink-3 hover:border-line-2 hover:text-ink max-lg:hidden"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
              </svg>
              View JSON
            </button>
          )}
          {canDelete && isDesktop && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete"
              disabled={deleting}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-3 transition hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
            </button>
          )}
          {!isReadOnly && hasSelection && (isDesktop || showMobileSave) && (
            <button
              type="button"
              onClick={onSave}
              disabled={!canEdit || saving || !dirty || oversize}
              aria-label={saving ? "Saving…" : isNew ? "Create note" : "Save"}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-[13px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
            >
              <span>{saving ? "Saving…" : isNew ? "Create note" : "Save"}</span>
              {isDesktop && (
                <span
                  aria-hidden
                  className="rounded bg-black/20 px-1.5 py-px font-mono text-[10px] opacity-70"
                >
                  ⌘S
                </span>
              )}
            </button>
          )}
          {!isDesktop && hasSelection && (
            <button
              type="button"
              onClick={() => setMobileActionsOpen(true)}
              aria-label="Note actions"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-3 transition hover:bg-surface-2 hover:text-ink"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 max-md:px-4 max-md:py-3">
        {conflictWarning && (
          <div className="flex items-start gap-2.5 rounded-xl border border-[color:color-mix(in_oklab,var(--color-warning)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--color-warning)_7%,var(--color-surface))] px-3.5 py-2.5 text-[12.5px] leading-[1.55] text-ink-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="mt-px shrink-0 text-[color:var(--color-warning)]"
              aria-hidden
            >
              <path d="M21 12a9 9 0 1 1-3-6.7" />
              <path d="M21 3v6h-6" />
            </svg>
            <span>{conflictWarning}</span>
          </div>
        )}

        {error && (
          <OperationResultNotice tone="error" title="Editor error">
            {error}
          </OperationResultNotice>
        )}

        {!contractReady ? (
          <OperationResultNotice title="No contract selected">
            <div className="space-y-3">
              <div>
                Open Settings to paste a contract ID or register a new Dashnote
                contract before creating notes.
              </div>
              <button
                type="button"
                onClick={onOpenSettings}
                className="rounded-full bg-accent px-3 py-1.5 text-[12px] font-semibold text-bg transition hover:bg-accent-dim"
              >
                Open Settings
              </button>
            </div>
          </OperationResultNotice>
        ) : !hasSelection ? (
          <OperationResultNotice title="No note selected">
            Choose a note from the list or create a new one to start writing.
          </OperationResultNotice>
        ) : loading && !note && !isNew ? (
          <div
            className="flex flex-1 items-center justify-center"
            role="status"
            aria-label="Loading note"
          >
            <svg
              className="h-7 w-7 animate-spin text-ink-4"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeOpacity="0.25"
                strokeWidth="3"
              />
              <path
                d="M22 12a10 10 0 0 1-10 10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        ) : (
          <>
            <label className="relative flex min-h-0 flex-1 flex-col">
              <input
                type="text"
                aria-label="Title"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder={isNew ? "New note title" : "Title"}
                disabled={!canEdit}
                className="mobile-note-editor-field w-full border-0 bg-transparent px-0 pt-0 pb-1 text-[28px] font-semibold leading-tight tracking-tight text-ink outline-none placeholder:text-ink-4 disabled:cursor-not-allowed disabled:text-ink-4"
              />
              <textarea
                aria-label="Body"
                value={message}
                onChange={(event) => onMessageChange(event.target.value)}
                placeholder="Start writing…"
                disabled={!canEdit}
                rows={16}
                className="mobile-note-editor-field w-full min-h-0 flex-1 border-0 bg-transparent px-0 py-1 text-[15px] leading-6 text-ink outline-none placeholder:text-ink-4 disabled:cursor-not-allowed disabled:text-ink-4 md:min-h-[340px] xl:min-h-0"
              />
              {(messageBytes / FIELD_BYTE_LIMIT >= 0.75 || messageOversize) && (
                <div className="mt-2 md:hidden">
                  <FillBar bytes={messageBytes} limit={FIELD_BYTE_LIMIT} />
                </div>
              )}
            </label>

            <div className="flex items-center gap-1.5 text-[11px] text-ink-4 md:hidden">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <span>
                Notes are stored publicly on Dash Platform — not encrypted.
              </span>
            </div>

            {isReadOnly && (
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition hover:bg-accent-dim md:hidden"
              >
                Sign in to edit
              </button>
            )}
          </>
        )}
      </div>
      {isDesktop && hasSelection && contractReady && (
        <div className="flex items-center justify-between gap-4 border-t border-line bg-[color:color-mix(in_oklab,var(--color-bg)_30%,var(--color-surface))] px-5 py-3">
          {note ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px] text-ink-3">
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-ink-4">$createdAt</span>
                <span>{formatTimestamp(note.createdAt)}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-ink-4">$updatedAt</span>
                <span>{formatTimestamp(note.updatedAt)}</span>
              </span>
            </div>
          ) : (
            <div className="text-[11.5px] text-ink-4">
              Platform metadata appears after the first save.
            </div>
          )}
          <div className="flex items-center gap-2 text-[11px] text-ink-4">
            <span>
              {messageBytes.toLocaleString()} /{" "}
              {FIELD_BYTE_LIMIT.toLocaleString()} B
            </span>
            <div className="w-20">
              <FillBar bytes={messageBytes} limit={FIELD_BYTE_LIMIT} />
            </div>
          </div>
        </div>
      )}
      <NoteJsonDrawer
        open={jsonOpen}
        note={note}
        contractId={contractId}
        onClose={() => setJsonOpen(false)}
      />
      <MobileActionSheet
        open={mobileActionsOpen}
        title="Note actions"
        onClose={() => setMobileActionsOpen(false)}
      >
        {note && (
          <button
            type="button"
            aria-label="Info"
            onClick={() => {
              setMobileActionsOpen(false);
              setMobileInfoOpen(true);
            }}
            className="flex min-h-12 w-full items-center justify-between rounded-xl px-4 py-3 text-left text-[15px] font-medium text-ink hover:bg-surface-2"
          >
            Info
            <span className="font-mono text-[11px] text-ink-4">
              Rev {note.revision}
            </span>
          </button>
        )}
        {note && (
          <button
            type="button"
            onClick={() => {
              setMobileActionsOpen(false);
              setJsonOpen(true);
            }}
            className="flex min-h-12 w-full items-center rounded-xl px-4 py-3 text-left text-[15px] font-medium text-ink hover:bg-surface-2"
          >
            View JSON
          </button>
        )}
        {isReadOnly && (
          <button
            type="button"
            onClick={() => {
              setMobileActionsOpen(false);
              onOpenLogin();
            }}
            className="flex min-h-12 w-full items-center rounded-xl px-4 py-3 text-left text-[15px] font-semibold text-accent hover:bg-surface-2"
          >
            Sign in to edit
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => {
              setMobileActionsOpen(false);
              onDelete();
            }}
            disabled={deleting}
            className="flex min-h-12 w-full items-center rounded-xl px-4 py-3 text-left text-[15px] font-semibold text-[color:var(--color-danger)] hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-ink-4"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
      </MobileActionSheet>
      <MobileActionSheet
        open={mobileInfoOpen}
        title="Note info"
        onClose={() => setMobileInfoOpen(false)}
      >
        {note ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 px-1 py-2 text-[13px]">
            <dt className="text-ink-4">Revision</dt>
            <dd className="text-right font-mono text-ink">{note.revision}</dd>
            <dt className="text-ink-4">Created</dt>
            <dd className="text-right text-ink">
              {formatTimestamp(note.createdAt)}
            </dd>
            <dt className="text-ink-4">Updated</dt>
            <dd className="text-right text-ink">
              {formatTimestamp(note.updatedAt)}
            </dd>
            <dt className="text-ink-4">Body</dt>
            <dd className="text-right font-mono text-ink">
              {messageBytes.toLocaleString()} /{" "}
              {FIELD_BYTE_LIMIT.toLocaleString()} B
            </dd>
          </dl>
        ) : (
          <div className="px-1 py-2 text-[13px] text-ink-3">
            Platform metadata appears after the first save.
          </div>
        )}
      </MobileActionSheet>
    </section>
  );
}

function FillBar({ bytes, limit }: { bytes: number; limit: number }) {
  const pct = Math.min(100, (bytes / limit) * 100);
  const over = bytes > limit;
  const near = !over && pct >= 90;
  const fill = over
    ? "bg-[color:var(--color-danger)]"
    : near
      ? "bg-[color:var(--color-warning)]"
      : "bg-accent";
  const tooltip = over
    ? `${bytes} / ${limit} bytes — over limit`
    : `${bytes} / ${limit} bytes`;
  return (
    <div
      role="progressbar"
      aria-valuenow={bytes}
      aria-valuemax={limit}
      aria-valuetext={tooltip}
      title={tooltip}
      className="h-[3px] w-full overflow-hidden rounded-full bg-surface-2"
    >
      <div
        className={`h-full rounded-full transition-[width,background-color] ${fill}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
