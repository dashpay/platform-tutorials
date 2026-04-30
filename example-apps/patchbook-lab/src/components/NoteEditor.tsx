import type { NoteRecord } from "../dash/queries";
import {
  formatRelativeTime,
  formatTimestamp,
  noteDisplayTitle,
} from "../lib/format";
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
  loading: boolean;
  saving: boolean;
  deleting: boolean;
  canEdit: boolean;
  canDelete: boolean;
  contractReady: boolean;
  error: string | null;
  onOpenSettings: () => void;
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
  loading,
  saving,
  deleting,
  canEdit,
  canDelete,
  contractReady,
  error,
  onOpenSettings,
}: NoteEditorProps) {
  const hasSelection = selectedId !== null;
  const isNew = selectedId === "new";

  return (
    <section className="rounded-[24px] border border-line bg-surface shadow-[0_20px_60px_-36px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
            {isNew ? "Draft" : "Note detail"}
          </div>
          <div className="mt-1 text-[18px] font-semibold tracking-tight text-ink">
            {hasSelection
              ? isNew
                ? "New note"
                : noteDisplayTitle({ title, message })
              : "Select a note"}
          </div>
        </div>
        <div className="flex gap-2">
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="rounded-full border border-line-2 px-3 py-1.5 text-[12px] font-semibold text-ink-2 transition hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)] disabled:cursor-not-allowed disabled:border-line disabled:text-ink-4"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
          {hasSelection && (
            <button
              type="button"
              onClick={onSave}
              disabled={!canEdit || saving}
              className="rounded-full bg-accent px-3 py-1.5 text-[12px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
            >
              {saving ? "Saving…" : isNew ? "Create note" : "Save"}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
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
        ) : loading ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-[13px] text-ink-4">
            Loading note…
          </div>
        ) : (
          <>
            <label className="block">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                Title
              </div>
              <input
                type="text"
                aria-label="Title"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="Optional title"
                disabled={!canEdit}
                className="w-full rounded-[18px] border border-line bg-bg px-4 py-3 text-[15px] text-ink outline-none transition focus:border-accent-dim disabled:cursor-not-allowed disabled:text-ink-4"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                Body
              </div>
              <textarea
                aria-label="Body"
                value={message}
                onChange={(event) => onMessageChange(event.target.value)}
                placeholder="Write a note. If you leave the title blank, the first non-empty line becomes the visible label."
                disabled={!canEdit}
                rows={16}
                className="min-h-[340px] w-full resize-y rounded-[18px] border border-line bg-bg px-4 py-3 text-[14px] leading-6 text-ink outline-none transition focus:border-accent-dim disabled:cursor-not-allowed disabled:text-ink-4"
              />
            </label>

            {note && (
              <div className="grid gap-3 rounded-[18px] border border-line bg-bg/70 px-4 py-4 text-[12px] text-ink-3 md:grid-cols-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                    Created
                  </div>
                  <div className="mt-1">{formatTimestamp(note.createdAt)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                    Updated
                  </div>
                  <div className="mt-1">{formatTimestamp(note.updatedAt)}</div>
                  <div className="mt-1 text-[11px] text-ink-4">
                    {formatRelativeTime(note.updatedAt)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                    Revision
                  </div>
                  <div className="mt-1 font-mono text-[13px] text-ink">
                    {note.revision}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
