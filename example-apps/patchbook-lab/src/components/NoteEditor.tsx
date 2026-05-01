import type { NoteRecord } from "../dash/queries";
import { FIELD_BYTE_LIMIT } from "../lib/fieldLimits";
import { formatRelativeTime, formatTimestamp } from "../lib/format";
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
  error: string | null;
  onOpenSettings: () => void;
  isReadOnly?: boolean;
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
  error,
  onOpenSettings,
  isReadOnly = false,
}: NoteEditorProps) {
  const hasSelection = selectedId !== null;
  const isNew = selectedId === "new";
  const oversize = messageOversize;

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-line bg-surface shadow-[0_20px_60px_-36px_rgba(0,0,0,0.45)] max-md:rounded-none max-md:border-0 max-md:shadow-none xl:h-full xl:rounded-none xl:border-0 xl:bg-transparent xl:shadow-none">
      <div className="flex h-[61px] items-center justify-between gap-3 border-b border-line px-4 py-3 max-md:h-auto max-md:px-3 max-md:py-2.5">
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
        <div className="min-w-0 flex-1 max-md:hidden">
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
          ) : (
            <input
              type="text"
              aria-label="Title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder={isNew ? "New note title" : "Title"}
              disabled={!canEdit}
              className="-mx-2 w-[calc(100%+1rem)] rounded-md border-0 bg-transparent px-2 py-0 text-[20px] font-semibold leading-7 tracking-tight text-ink outline-none transition-colors placeholder:text-ink-4 hover:bg-surface-2 focus:bg-surface-2 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-ink-4"
            />
          )}
        </div>
        <div className="flex-1 md:hidden" />

        <div className="flex gap-2">
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="rounded-full border border-line-2 px-3 py-1.5 text-[12px] font-semibold text-ink-2 transition hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)] disabled:cursor-not-allowed disabled:border-line disabled:text-ink-4 max-md:hidden"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
          {isReadOnly ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-full bg-accent px-3 py-1.5 text-[12px] font-semibold text-bg transition hover:bg-accent-dim"
            >
              Sign in to edit
            </button>
          ) : (
            hasSelection && (
              <button
                type="button"
                onClick={onSave}
                disabled={!canEdit || saving || !dirty || oversize}
                className="rounded-full bg-accent px-3 py-1.5 text-[12px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
              >
                {saving ? "Saving…" : isNew ? "Create note" : "Save"}
              </button>
            )
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 max-md:px-4 max-md:py-3">
        {error && (
          <OperationResultNotice tone="error" title="Editor error">
            {error}
          </OperationResultNotice>
        )}

        {!contractReady ? (
          <OperationResultNotice title="No contract selected">
            <div className="space-y-3">
              <div>
                Open Settings to paste a contract ID or register a new Patchbook
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
            <input
              type="text"
              aria-label="Title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Title"
              disabled={!canEdit}
              className="w-full border-0 bg-transparent px-0 py-1 text-[22px] font-semibold tracking-tight text-ink outline-none placeholder:text-ink-4 disabled:cursor-not-allowed disabled:text-ink-4 md:hidden"
            />

            <label className="flex min-h-0 flex-1 flex-col">
              <div className="mb-2 flex items-center justify-between gap-3 max-md:hidden">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4 shrink-0">
                  Body
                </div>
                <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-ink-4">
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
                  <span className="truncate">
                    Notes are stored publicly on Dash Platform — not encrypted.
                  </span>
                </div>
              </div>
              <textarea
                aria-label="Body"
                value={message}
                onChange={(event) => onMessageChange(event.target.value)}
                placeholder="Write a note. If you leave the title blank, the first non-empty line becomes the visible label."
                disabled={!canEdit}
                rows={16}
                className="w-full min-h-0 flex-1 rounded-[18px] border border-line bg-bg px-4 py-3 text-[14px] leading-6 text-ink outline-none transition focus:border-accent-dim disabled:cursor-not-allowed disabled:text-ink-4 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:py-1 max-md:text-[15px] max-md:leading-6 md:min-h-[340px] xl:min-h-0"
              />
              <div
                className={`mt-1 text-right text-[11px] md:hidden ${
                  messageOversize
                    ? "text-[color:var(--color-danger)]"
                    : "text-ink-4"
                }`}
              >
                {messageBytes} / {FIELD_BYTE_LIMIT} bytes
              </div>
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

            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-3 text-[11px] text-ink-3 max-md:hidden">
              {note && (
                <>
                  <div>
                    <span className="text-ink-4">Created </span>
                    {formatTimestamp(note.createdAt)}
                  </div>
                  <div>
                    <span className="text-ink-4">Updated </span>
                    {formatTimestamp(note.updatedAt)}
                    <span className="ml-1 text-ink-4">
                      ({formatRelativeTime(note.updatedAt)})
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-4">Rev </span>
                    <span className="font-mono text-ink-2">
                      {note.revision}
                    </span>
                  </div>
                </>
              )}
              <div
                className={`ml-auto ${
                  messageOversize ? "text-[color:var(--color-danger)]" : ""
                }`}
              >
                <span className="text-ink-4">Bytes </span>
                {messageBytes} / {FIELD_BYTE_LIMIT}
              </div>
            </div>

            {canDelete && (
              <div className="mt-2 flex justify-center md:hidden">
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-medium text-[color:var(--color-danger)] transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-ink-4"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                  {deleting ? "Deleting…" : "Delete note"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
