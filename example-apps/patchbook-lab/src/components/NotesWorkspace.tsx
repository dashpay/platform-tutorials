import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { createNote } from "../dash/createNote";
import { deleteNote } from "../dash/deleteNote";
import { errorMessage } from "../dash/logger";
import { getNote, listMyNotes, type NoteRecord } from "../dash/queries";
import { updateNote } from "../dash/updateNote";
import { byteLength, FIELD_BYTE_LIMIT } from "../lib/fieldLimits";
import { useMediaQuery } from "../lib/useMediaQuery";
import { useSession } from "../session/useSession";
import { NoteEditor } from "./NoteEditor";
import { NoteList } from "./NoteList";

type SelectedNoteId = string | "new" | null;

export function NotesWorkspace({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const session = useSession();
  const { status, sdk, keyManager, contractId, identityId, log } = session;
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [selectedId, setSelectedId] = useState<SelectedNoteId>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [baselineTitle, setBaselineTitle] = useState("");
  const [baselineMessage, setBaselineMessage] = useState("");
  const [selectedNote, setSelectedNote] = useState<NoteRecord | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthed = status === "authenticated";
  const contractReady = Boolean(contractId);
  const canMutate = Boolean(isAuthed && sdk && keyManager && contractId);
  const dirty = title !== baselineTitle || message !== baselineMessage;
  const messageBytes = byteLength(message);
  const messageOversize = messageBytes > FIELD_BYTE_LIMIT;

  const hasMeaningfulContent = useMemo(
    () => Boolean(title.trim() || message.trim()),
    [title, message],
  );

  const resetDraft = useCallback(() => {
    setSelectedId("new");
    setSelectedNote(null);
    setTitle("");
    setMessage("");
    setBaselineTitle("");
    setBaselineMessage("");
    setError(null);
  }, []);

  const reloadNotes = useCallback(
    async (preferredId?: SelectedNoteId) => {
      if (!sdk || !contractId || !identityId || status !== "authenticated") {
        setNotes([]);
        setSelectedNote(null);
        setSelectedId(null);
        setTitle("");
        setMessage("");
        setBaselineTitle("");
        setBaselineMessage("");
        return;
      }

      setListLoading(true);
      setError(null);
      try {
        const nextNotes = await listMyNotes({
          sdk,
          contractId,
          ownerId: identityId,
          log,
        });
        setNotes(nextNotes);
        setSelectedId((current) => {
          if (preferredId === "new") return "new";
          if (
            typeof preferredId === "string" &&
            nextNotes.some((note) => note.id === preferredId)
          ) {
            return preferredId;
          }
          if (
            typeof current === "string" &&
            current !== "new" &&
            nextNotes.some((note) => note.id === current)
          ) {
            return current;
          }
          if (current === "new") return current;
          return isDesktop ? (nextNotes[0]?.id ?? null) : null;
        });
      } catch (err) {
        setError(errorMessage(err));
        setNotes([]);
      } finally {
        setListLoading(false);
      }
    },
    [contractId, identityId, log, sdk, status, isDesktop],
  );

  useEffect(() => {
    void reloadNotes();
  }, [reloadNotes]);

  const loadTokenRef = useRef(0);

  const loadNoteDetail = useCallback(
    async (noteId: string) => {
      if (!sdk || !contractId) return;
      const token = ++loadTokenRef.current;
      setDetailLoading(true);
      try {
        const note = await getNote({ sdk, contractId, noteId, log });
        if (loadTokenRef.current !== token) return;
        setSelectedNote(note);
        setTitle(note?.title ?? "");
        setMessage(note?.message ?? "");
        setBaselineTitle(note?.title ?? "");
        setBaselineMessage(note?.message ?? "");
      } catch (err) {
        if (loadTokenRef.current === token) setError(errorMessage(err));
      } finally {
        if (loadTokenRef.current === token) setDetailLoading(false);
      }
    },
    [contractId, log, sdk],
  );

  useEffect(() => {
    if (selectedId === "new") {
      setSelectedNote(null);
      return;
    }
    if (!selectedId || !sdk || !contractId) {
      setSelectedNote(null);
      return;
    }
    void loadNoteDetail(selectedId);
  }, [contractId, loadNoteDetail, sdk, selectedId]);

  function confirmDiscard(): boolean {
    if (!dirty) return true;
    return window.confirm("Discard unsaved changes?");
  }

  function handleSelect(noteId: string) {
    if (!confirmDiscard()) return;
    setSelectedId(noteId);
    setError(null);
  }

  function handleBack() {
    if (!confirmDiscard()) return;
    setSelectedId(null);
    setSelectedNote(null);
    setTitle("");
    setMessage("");
    setBaselineTitle("");
    setBaselineMessage("");
    setError(null);
  }

  function handleNew() {
    if (!canMutate) return;
    if (!confirmDiscard()) return;
    resetDraft();
  }

  async function handleSave() {
    if (!sdk || !keyManager || !contractId || !isAuthed) return;
    if (!hasMeaningfulContent) {
      setError("Add a title or body before saving.");
      return;
    }
    if (messageOversize) {
      setError(
        `Body exceeds the ${FIELD_BYTE_LIMIT}-byte field limit (${messageBytes} B).`,
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (selectedId === "new" || selectedId === null) {
        const noteId = await createNote({
          sdk,
          keyManager,
          contractId,
          title,
          message,
          log,
        });
        await reloadNotes(noteId);
      } else {
        await updateNote({
          sdk,
          keyManager,
          contractId,
          noteId: selectedId,
          title,
          message,
          log,
        });
        await loadNoteDetail(selectedId);
        await reloadNotes(selectedId);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!sdk || !keyManager || !contractId || !isAuthed || !selectedId) return;
    if (selectedId === "new") {
      resetDraft();
      return;
    }
    if (!window.confirm("Delete this note permanently?")) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteNote({
        sdk,
        keyManager,
        contractId,
        noteId: selectedId,
        log,
      });
      await reloadNotes();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5 max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col max-md:space-y-2">
      {!isAuthed ? (
        <EmptyState
          icon={
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          }
          title="Sign in to see your notes"
          description="Patchbook stores notes against your testnet identity. Log in with a Dash Platform identity to create, edit, and review your notes."
          actionLabel="Log in"
          onAction={onOpenSettings}
          secondaryHref="https://bridge.thepasta.org/"
          secondaryLabel="Need an identity? Create one on Dash Bridge"
          footnote="Notes are not private. They are stored publicly on Dash Platform."
        />
      ) : !contractReady ? (
        <EmptyState
          icon={
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M9 13h6M9 17h6" />
            </svg>
          }
          title="Register or select a contract"
          description="Open Settings to register a Patchbook note contract or paste a contract ID before creating notes."
          actionLabel="Open Settings"
          onAction={onOpenSettings}
        />
      ) : (
        <div className="gap-5 max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col xl:grid xl:h-[calc(100vh-220px)] xl:min-h-[520px] xl:grid-cols-[340px_minmax(0,1fr)]">
          <div
            className={`min-h-0 max-md:flex-1 ${selectedId !== null ? "hidden md:flex" : "flex"} flex-col`}
          >
            <NoteList
              notes={notes}
              loading={listLoading}
              selectedId={selectedId}
              onSelect={handleSelect}
              onNew={handleNew}
              canCreate={canMutate}
            />
          </div>
          <div
            className={`min-h-0 max-md:flex-1 ${selectedId === null ? "hidden md:flex" : "flex"} flex-col`}
          >
            <NoteEditor
              selectedId={selectedId}
              note={selectedNote}
              title={title}
              message={message}
              onTitleChange={setTitle}
              onMessageChange={setMessage}
              onSave={() => void handleSave()}
              onDelete={() => void handleDelete()}
              onBack={handleBack}
              loading={detailLoading}
              saving={saving}
              deleting={deleting}
              canEdit={canMutate}
              canDelete={Boolean(
                canMutate && selectedId && selectedId !== "new",
              )}
              dirty={dirty}
              messageBytes={messageBytes}
              messageOversize={messageOversize}
              contractReady={contractReady}
              error={error}
              onOpenSettings={onOpenSettings}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryHref,
  secondaryLabel,
  footnote,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  secondaryHref?: string;
  secondaryLabel?: string;
  footnote?: string;
}) {
  return (
    <div className="flex flex-1 flex-col px-6 py-10 text-center max-md:py-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 max-md:-translate-y-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-ink-3">
          {icon}
        </div>
        <div className="max-w-[320px] space-y-2">
          <div className="text-[16px] font-semibold text-ink">{title}</div>
          <div className="text-[13px] leading-6 text-ink-3">{description}</div>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-bg transition hover:bg-accent-dim"
        >
          {actionLabel}
        </button>
        {secondaryHref && secondaryLabel && (
          <a
            href={secondaryHref}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-medium text-accent underline-offset-2 hover:underline"
          >
            {secondaryLabel}
          </a>
        )}
      </div>
      {footnote && (
        <div className="mt-4 truncate text-[11px] leading-5 text-ink-4">
          {footnote}
        </div>
      )}
    </div>
  );
}
