import { useCallback, useEffect, useMemo, useState } from "react";

import { createNote } from "../dash/createNote";
import { deleteNote } from "../dash/deleteNote";
import { errorMessage } from "../dash/logger";
import { getNote, listMyNotes, type NoteRecord } from "../dash/queries";
import { updateNote } from "../dash/updateNote";
import { useSession } from "../session/useSession";
import { NoteEditor } from "./NoteEditor";
import { NoteList } from "./NoteList";
import { OperationResultNotice } from "./OperationResultNotice";

type SelectedNoteId = string | "new" | null;

export function NotesWorkspace({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const session = useSession();
  const { status, sdk, keyManager, contractId, identityId, log } = session;

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
          return nextNotes[0]?.id ?? null;
        });
      } catch (err) {
        setError(errorMessage(err));
        setNotes([]);
      } finally {
        setListLoading(false);
      }
    },
    [contractId, identityId, log, sdk, status],
  );

  useEffect(() => {
    void reloadNotes();
  }, [reloadNotes]);

  useEffect(() => {
    if (selectedId === "new") {
      setSelectedNote(null);
      return;
    }
    if (!selectedId || !sdk || !contractId) {
      setSelectedNote(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void getNote({
      sdk,
      contractId,
      noteId: selectedId,
      log,
    })
      .then((note) => {
        if (cancelled) return;
        setSelectedNote(note);
        setTitle(note?.title ?? "");
        setMessage(note?.message ?? "");
        setBaselineTitle(note?.title ?? "");
        setBaselineMessage(note?.message ?? "");
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contractId, log, sdk, selectedId]);

  function confirmDiscard(): boolean {
    if (!dirty) return true;
    return window.confirm("Discard unsaved changes?");
  }

  function handleSelect(noteId: string) {
    if (!confirmDiscard()) return;
    setSelectedId(noteId);
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
    <div className="space-y-5">
      {!isAuthed && (
        <OperationResultNotice title="Login required">
          <div className="flex flex-col items-start gap-3">
            <div>
              Patchbook keeps the notebook UI visible, but note creation,
              editing, and deletion require signing in with a testnet identity.
            </div>
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-full bg-accent px-3 py-1.5 text-[12px] font-semibold text-bg transition hover:bg-accent-dim"
            >
              Log in
            </button>
          </div>
        </OperationResultNotice>
      )}

      {isAuthed && !contractReady && (
        <OperationResultNotice title="Register or select a contract">
          <div className="flex flex-col items-start gap-3">
            <div>
              Open Settings to register a Patchbook note contract or paste a
              contract ID before creating notes.
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
      )}

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <NoteList
          notes={notes}
          loading={listLoading}
          selectedId={selectedId}
          onSelect={handleSelect}
          onNew={handleNew}
          canCreate={canMutate}
        />
        <NoteEditor
          selectedId={selectedId}
          note={selectedNote}
          title={title}
          message={message}
          onTitleChange={setTitle}
          onMessageChange={setMessage}
          onSave={() => void handleSave()}
          onDelete={() => void handleDelete()}
          loading={detailLoading}
          saving={saving}
          deleting={deleting}
          canEdit={canMutate}
          canDelete={Boolean(canMutate && selectedId && selectedId !== "new")}
          contractReady={contractReady}
          error={error}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </div>
  );
}
