import type { NoteRecord } from "../dash/queries";
import {
  formatCompactTimestamp,
  formatRelativeTime,
  noteDisplayTitle,
  notePreview,
} from "../lib/format";

interface NoteListProps {
  notes: NoteRecord[];
  loading: boolean;
  selectedId: string | "new" | null;
  onSelect: (noteId: string) => void;
  onNew: () => void;
  canCreate: boolean;
}

export function NoteList({
  notes,
  loading,
  selectedId,
  onSelect,
  onNew,
  canCreate,
}: NoteListProps) {
  return (
    <section className="rounded-[24px] border border-line bg-surface shadow-[0_20px_60px_-36px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
            My notes
          </div>
          <div className="mt-1 text-[13px] text-ink-3">
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </div>
        </div>
        <button
          type="button"
          onClick={onNew}
          disabled={!canCreate}
          className="rounded-full bg-accent px-3 py-1.5 text-[12px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
        >
          New note
        </button>
      </div>

      <div className="max-h-[calc(100vh-270px)] overflow-y-auto p-3">
        {loading && notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-ink-4">
            Loading notes…
          </div>
        ) : notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-ink-4">
            No notes yet.
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => {
              const active = selectedId === note.id;
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onSelect(note.id)}
                  className={`block w-full rounded-[18px] border px-3 py-3 text-left transition ${
                    active
                      ? "border-accent bg-surface-2 shadow-[0_16px_35px_-28px_rgba(0,0,0,0.5)]"
                      : "border-transparent bg-transparent hover:border-line hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-ink">
                        {noteDisplayTitle(note)}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-ink-3">
                        {notePreview(note.message)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] font-medium text-ink-4">
                        {formatRelativeTime(note.updatedAt)}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-ink-4">
                        {formatCompactTimestamp(note.updatedAt)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
