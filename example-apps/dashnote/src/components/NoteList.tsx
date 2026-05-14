import { useEffect, useMemo, useRef, useState } from "react";

import type { NoteRecord } from "../dash/queries";
import {
  formatRelativeTime,
  noteDisplayTitle,
  notePreview,
} from "../lib/format";

interface NoteListProps {
  notes: NoteRecord[];
  loading: boolean;
  revalidating?: boolean;
  selectedId: string | "new" | null;
  onSelect: (noteId: string) => void;
  onNew: () => void;
  canCreate: boolean;
  newButtonLabel?: string;
}

export function NoteList({
  notes,
  loading,
  revalidating = false,
  selectedId,
  onSelect,
  onNew,
  canCreate,
  newButtonLabel = "New note",
}: NoteListProps) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target;
      const editable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (editable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((note) => {
      const title = noteDisplayTitle(note).toLowerCase();
      const body = (note.message ?? "").toLowerCase();
      return title.includes(q) || body.includes(q);
    });
  }, [notes, search]);

  const searching = search.trim().length > 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-line bg-surface shadow-[0_20px_60px_-36px_rgba(0,0,0,0.45)] max-md:rounded-none max-md:border-0 max-md:border-t max-md:border-t-line max-md:shadow-none md:h-full md:rounded-none md:border-0 md:bg-transparent md:shadow-none">
      <div className="flex h-[61px] items-center justify-between border-b border-line px-4 py-3 max-md:h-auto">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
            My notes
          </div>
          <div className="mt-1 flex items-center gap-2 text-[13px] text-ink-3">
            <span>
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </span>
            {revalidating && (
              <span
                className="inline-flex items-center gap-1 text-[11px] text-ink-4"
                role="status"
                aria-label="Refreshing notes"
              >
                <svg
                  className="h-3 w-3 animate-spin"
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
                Refreshing…
              </span>
            )}
          </div>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={onNew}
            className="rounded-full bg-accent px-3 py-1.5 text-[12px] font-semibold text-bg transition hover:bg-accent-dim max-md:hidden"
          >
            {newButtonLabel}
          </button>
        )}
      </div>

      <div className="px-3 py-2.5">
        <label className="relative block">
          <span className="sr-only">Search notes</span>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            className="w-full rounded-full border border-line bg-bg px-9 py-2 text-[13px] text-ink outline-none transition focus:border-accent-dim"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line bg-bg px-1.5 py-px font-mono text-[10px] text-ink-4"
          >
            /
          </span>
        </label>
      </div>

      <div className="max-h-[calc(100vh-270px)] min-h-0 flex-1 overflow-y-auto p-3 xl:max-h-none">
        {loading && notes.length === 0 ? (
          <div
            className="flex flex-1 items-center justify-center py-12"
            role="status"
            aria-label="Loading notes"
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
        ) : filteredNotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-ink-4">
            {searching ? "No notes match that search." : "No notes yet."}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotes.map((note) => {
              const active = selectedId === note.id;
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onSelect(note.id)}
                  className={`relative block w-full overflow-hidden rounded-lg px-3 py-3 text-left transition ${
                    active
                      ? "bg-surface-2"
                      : "bg-transparent hover:bg-surface-2"
                  }`}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-3 left-0 w-0.5 rounded-r-sm bg-accent"
                    />
                  )}
                  <div className="relative">
                    <div className="flex items-baseline justify-between gap-3">
                      <div
                        className={`min-w-0 truncate text-[13.5px] font-semibold tracking-[-0.005em] text-ink ${
                          note.title?.trim() ? "" : "italic text-ink-2"
                        }`}
                      >
                        {noteDisplayTitle(note)}
                      </div>
                      <div className="shrink-0 text-[10.5px] text-ink-4">
                        {formatRelativeTime(note.updatedAt)}
                      </div>
                    </div>
                    <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-ink-3">
                      {notePreview(note.message)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {canCreate && (
        <button
          type="button"
          onClick={onNew}
          aria-label="Compose note"
          className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-[0_16px_35px_-12px_rgba(0,0,0,0.45)] transition hover:bg-accent-dim md:hidden"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </button>
      )}
    </section>
  );
}
