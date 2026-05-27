import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";

import type { NoteRecord } from "../dash/queries";
import {
  formatTimestamp,
  formatRelativeTime,
  noteDisplayTitle,
  notePreview,
} from "../lib/format";
import { MobileActionSheet } from "./MobileActionSheet";

interface NoteListProps {
  notes: NoteRecord[];
  loading: boolean;
  revalidating?: boolean;
  selectedId: string | "new" | null;
  onSelect: (noteId: string) => void;
  onNew: () => void;
  canCreate: boolean;
  newButtonLabel?: string;
  isDesktop?: boolean;
  canDeleteNotes?: boolean;
  isReadOnly?: boolean;
  onDeleteNote?: (note: NoteRecord) => void;
  onOpenLogin?: () => void;
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
  isDesktop = true,
  canDeleteNotes = false,
  isReadOnly = false,
  onDeleteNote,
  onOpenLogin,
}: NoteListProps) {
  const [search, setSearch] = useState("");
  const [actionsNote, setActionsNote] = useState<NoteRecord | null>(null);
  const [infoNote, setInfoNote] = useState<NoteRecord | null>(null);
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const gestureRef = useRef<{
    noteId: string;
    startX: number;
    startY: number;
    ignored: boolean;
    vertical: boolean;
    horizontal: boolean;
    latestOffset: number;
    pointerId?: number;
  } | null>(null);
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
  const revealedWidth = 156;

  function closeRowActions() {
    setOpenSwipeId(null);
    setDraggingId(null);
    setDragOffset(0);
    gestureRef.current = null;
  }

  function startGesture(
    event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
    noteId: string,
    pointerId?: number,
  ) {
    if (isDesktop || event.button > 0) return;
    gestureRef.current = {
      noteId,
      startX: event.clientX,
      startY: event.clientY,
      ignored: event.clientX < 20,
      vertical: false,
      horizontal: false,
      latestOffset: 0,
      pointerId,
    };
  }

  function handlePointerDown(
    event: PointerEvent<HTMLDivElement>,
    noteId: string,
  ) {
    startGesture(event, noteId, event.pointerId);
  }

  function handleMouseDown(event: MouseEvent<HTMLDivElement>, noteId: string) {
    if ("PointerEvent" in window) return;
    startGesture(event, noteId);
  }

  function moveGesture(
    event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
  ) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.ignored || isDesktop) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (!gesture.horizontal && absY > 12 && absY > absX) {
      gesture.vertical = true;
      setDraggingId(null);
      setDragOffset(0);
      return;
    }
    if (gesture.vertical) return;
    if (absX > 12 && absX > absY) {
      gesture.horizontal = true;
      if ("pointerId" in event && gesture.pointerId !== undefined) {
        event.currentTarget.setPointerCapture?.(gesture.pointerId);
      }
    }
    if (!gesture.horizontal) return;
    event.preventDefault();
    const offset = Math.max(-revealedWidth, Math.min(0, dx));
    gesture.latestOffset = offset;
    setDraggingId(gesture.noteId);
    setOpenSwipeId((current) =>
      current && current !== gesture.noteId ? null : current,
    );
    setDragOffset(offset);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    moveGesture(event);
  }

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    if ("PointerEvent" in window) return;
    moveGesture(event);
  }

  function endGesture(event?: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (gesture.pointerId !== undefined) {
      event?.currentTarget.releasePointerCapture?.(gesture.pointerId);
    }
    if (gesture.ignored || gesture.vertical || isDesktop) {
      gestureRef.current = null;
      setDraggingId(null);
      setDragOffset(0);
      return;
    }
    setOpenSwipeId(gesture.latestOffset <= -48 ? gesture.noteId : null);
    setDraggingId(null);
    setDragOffset(0);
    gestureRef.current = null;
  }

  function handlePointerEnd(event?: PointerEvent<HTMLDivElement>) {
    endGesture(event);
  }

  function handleMouseEnd() {
    if ("PointerEvent" in window) return;
    endGesture();
  }

  function openActions(note: NoteRecord) {
    setActionsNote(note);
    closeRowActions();
  }

  function deleteOrSignIn(note: NoteRecord) {
    closeRowActions();
    if (canDeleteNotes && onDeleteNote) {
      onDeleteNote(note);
      return;
    }
    onOpenLogin?.();
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-line bg-surface shadow-[0_20px_60px_-36px_rgba(0,0,0,0.45)] max-md:rounded-none max-md:border-0 max-md:shadow-none md:h-full md:rounded-none md:border-0 md:bg-transparent md:shadow-none">
      {isDesktop && (
        <div className="flex h-[61px] items-center justify-between border-b border-line px-4 py-3">
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
              className="rounded-full bg-accent px-3 py-1.5 text-[12px] font-semibold text-bg transition hover:bg-accent-dim"
            >
              {newButtonLabel}
            </button>
          )}
        </div>
      )}
      <div className="relative px-3 py-2.5 max-md:sticky max-md:top-[53px] max-md:z-20 max-md:border-b max-md:border-[color:color-mix(in_oklab,var(--color-line)_58%,transparent)] max-md:bg-surface/95 max-md:py-2 max-md:backdrop-blur">
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
            className="w-full rounded-full border border-line bg-bg px-9 py-2 text-[13px] text-ink outline-none transition focus:border-accent-dim max-md:py-1.5"
          />
          {isDesktop && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line bg-bg px-1.5 py-px font-mono text-[10px] text-ink-4"
            >
              /
            </span>
          )}
        </label>
        {!isDesktop && revalidating && (
          <span
            className="pointer-events-none absolute right-6 top-1/2 inline-flex -translate-y-1/2 items-center text-ink-4"
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
          </span>
        )}
      </div>

      <div
        className="max-h-[calc(100vh-270px)] min-h-0 flex-1 overflow-y-auto p-3 max-md:max-h-none max-md:pt-4 xl:max-h-none"
        onScroll={() => {
          if (!isDesktop) closeRowActions();
        }}
      >
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
              const open = openSwipeId === note.id;
              const dragging = draggingId === note.id;
              const translate = dragging
                ? dragOffset
                : open
                  ? -revealedWidth
                  : 0;
              return (
                <div
                  key={note.id}
                  data-testid={`note-row-${note.id}`}
                  className="relative overflow-hidden rounded-lg [touch-action:pan-y]"
                  onPointerDown={(event) => handlePointerDown(event, note.id)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerEnd}
                  onPointerCancel={handlePointerEnd}
                  onMouseDown={(event) => handleMouseDown(event, note.id)}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseEnd}
                >
                  {!isDesktop && (
                    <div
                      className="absolute inset-y-0 right-0 flex w-[156px] items-stretch justify-end overflow-hidden rounded-lg bg-surface-2"
                      aria-hidden={!open}
                    >
                      <button
                        type="button"
                        tabIndex={open ? 0 : -1}
                        onClick={() => openActions(note)}
                        className="flex w-[78px] items-center justify-center text-[12px] font-semibold text-ink"
                      >
                        More
                      </button>
                      <button
                        type="button"
                        tabIndex={open ? 0 : -1}
                        onClick={() => deleteOrSignIn(note)}
                        className={`flex w-[78px] items-center justify-center text-[12px] font-semibold ${
                          canDeleteNotes
                            ? "bg-[color:var(--color-danger)] text-bg"
                            : "bg-accent text-bg"
                        }`}
                      >
                        {canDeleteNotes ? "Delete" : "Sign in"}
                      </button>
                    </div>
                  )}
                  <div
                    data-testid={`note-row-foreground-${note.id}`}
                    className={`relative max-md:bg-surface transition-transform ${dragging ? "" : "duration-150 ease-out"}`}
                    style={
                      !isDesktop
                        ? { transform: `translateX(${translate}px)` }
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      aria-label={`Open ${noteDisplayTitle(note)}`}
                      onClick={() => {
                        if (openSwipeId) {
                          closeRowActions();
                          return;
                        }
                        onSelect(note.id);
                      }}
                      className={`relative block w-full overflow-hidden rounded-lg px-3 py-3 text-left transition max-md:pr-12 ${
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
                    {!isDesktop && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openActions(note);
                        }}
                        aria-label={`Actions for ${noteDisplayTitle(note)}`}
                        className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-4 hover:bg-surface-2 hover:text-ink"
                      >
                        <svg
                          width="18"
                          height="18"
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
      <MobileActionSheet
        open={Boolean(actionsNote)}
        title="Note actions"
        onClose={() => setActionsNote(null)}
      >
        {actionsNote && (
          <>
            <button
              type="button"
              onClick={() => {
                const noteId = actionsNote.id;
                setActionsNote(null);
                onSelect(noteId);
              }}
              className="flex min-h-12 w-full items-center rounded-xl px-4 py-3 text-left text-[15px] font-medium text-ink hover:bg-surface-2"
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => {
                setInfoNote(actionsNote);
                setActionsNote(null);
              }}
              className="flex min-h-12 w-full items-center rounded-xl px-4 py-3 text-left text-[15px] font-medium text-ink hover:bg-surface-2"
            >
              Info
            </button>
            {canDeleteNotes ? (
              <button
                type="button"
                onClick={() => {
                  const note = actionsNote;
                  setActionsNote(null);
                  onDeleteNote?.(note);
                }}
                className="flex min-h-12 w-full items-center rounded-xl px-4 py-3 text-left text-[15px] font-semibold text-[color:var(--color-danger)] hover:bg-surface-2"
              >
                Delete
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActionsNote(null);
                  onOpenLogin?.();
                }}
                className="flex min-h-12 w-full items-center rounded-xl px-4 py-3 text-left text-[15px] font-semibold text-accent hover:bg-surface-2"
              >
                {isReadOnly ? "Sign in to edit" : "Sign in"}
              </button>
            )}
          </>
        )}
      </MobileActionSheet>
      <MobileActionSheet
        open={Boolean(infoNote)}
        title="Note info"
        onClose={() => setInfoNote(null)}
      >
        {infoNote && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 px-1 py-2 text-[13px]">
            <dt className="text-ink-4">Revision</dt>
            <dd className="text-right font-mono text-ink">
              {infoNote.revision}
            </dd>
            <dt className="text-ink-4">Created</dt>
            <dd className="text-right text-ink">
              {formatTimestamp(infoNote.createdAt)}
            </dd>
            <dt className="text-ink-4">Updated</dt>
            <dd className="text-right text-ink">
              {formatTimestamp(infoNote.updatedAt)}
            </dd>
          </dl>
        )}
      </MobileActionSheet>
    </section>
  );
}
