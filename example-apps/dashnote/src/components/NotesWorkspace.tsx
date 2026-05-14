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
import { getNote, listMyNotes, type NoteRecord } from "../dash/queries";
import { updateNote } from "../dash/updateNote";
import { DeleteNoteModal } from "./DeleteNoteModal";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { byteLength, FIELD_BYTE_LIMIT } from "../lib/fieldLimits";
import { errorMessage } from "../lib/logger";
import {
  BACKGROUND_REFRESH_MS,
  FOCUS_REFRESH_MIN_MS,
  loadCachedNotes,
  notesEqualByRevision,
  saveCachedNotes,
} from "../lib/notesCache";
import { useSession } from "../session/useSession";
import { NoteEditor } from "./NoteEditor";
import { NoteList } from "./NoteList";

const NETWORK = "testnet" as const;
const STALE_EDIT_WARNING =
  "This note changed on the network. Your unsaved edits are still here — saving will overwrite the newer version.";

type SelectedNoteId = string | "new" | null;

export function NotesWorkspace({
  onOpenLogin,
  onOpenSettings,
}: {
  onOpenLogin: () => void;
  onOpenSettings: () => void;
}) {
  const session = useSession();
  const { status, sdk, keyManager, contractId, identityId, log } = session;
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const initialCachedNotes =
    identityId && contractId
      ? (loadCachedNotes(identityId, contractId, NETWORK) ?? [])
      : [];
  // Seed the editor from the first cached note on desktop so the right pane
  // paints with content on frame 1 instead of "No note selected" flashing
  // through before the hydrate effect picks one.
  const initialSelected =
    isDesktop && initialCachedNotes.length > 0 ? initialCachedNotes[0] : null;

  const [notes, setNotes] = useState<NoteRecord[]>(initialCachedNotes);
  const [selectedId, setSelectedId] = useState<SelectedNoteId>(
    initialSelected?.id ?? null,
  );
  const [title, setTitle] = useState(initialSelected?.title ?? "");
  const [message, setMessage] = useState(initialSelected?.message ?? "");
  const [baselineTitle, setBaselineTitle] = useState(
    initialSelected?.title ?? "",
  );
  const [baselineMessage, setBaselineMessage] = useState(
    initialSelected?.message ?? "",
  );
  const [selectedNote, setSelectedNote] = useState<NoteRecord | null>(
    initialSelected,
  );
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revalidating, setRevalidating] = useState(false);
  const [editsReady, setEditsReady] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const lastRevalidatedAt = useRef(0);
  const inFlightWriteRef = useRef(false);
  // Monotonic token so a late listMyNotes() response from a previous
  // identity/contract/session can't clobber state for the current one.
  const reloadTokenRef = useRef(0);
  // Mirror editor state in refs so revalidation routines can compare against
  // the live values without participating in their dependency arrays (which
  // would re-fire effects on every keystroke).
  const titleRef = useRef("");
  const messageRef = useRef("");
  const baselineTitleRef = useRef("");
  const baselineMessageRef = useRef("");
  const selectedIdRef = useRef<SelectedNoteId>(null);
  const notesRef = useRef<NoteRecord[]>([]);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  useEffect(() => {
    messageRef.current = message;
  }, [message]);
  useEffect(() => {
    baselineTitleRef.current = baselineTitle;
  }, [baselineTitle]);
  useEffect(() => {
    baselineMessageRef.current = baselineMessage;
  }, [baselineMessage]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const isAuthed = status === "authenticated";
  const isBrowsing = status === "browsing";
  const canRead = isAuthed || isBrowsing;
  const contractReady = Boolean(contractId);
  const canMutate = Boolean(
    isAuthed && sdk && keyManager && contractId && editsReady,
  );
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
      const sessionTornDown =
        !contractId ||
        !identityId ||
        (status !== "authenticated" && status !== "browsing");
      if (sessionTornDown) {
        setNotes([]);
        setSelectedNote(null);
        setSelectedId(null);
        setTitle("");
        setMessage("");
        setBaselineTitle("");
        setBaselineMessage("");
        setEditsReady(false);
        return;
      }
      if (!sdk) {
        // SDK is still connecting after a remembered-identity rehydrate. Keep
        // any cached notes on screen and wait for the effect to re-run once
        // `sdk` lands in the deps array.
        return;
      }

      const prevNotes = notesRef.current;
      const hadNotes = prevNotes.length > 0;
      if (!hadNotes) setListLoading(true);
      setRevalidating(true);
      setError(null);
      reloadTokenRef.current += 1;
      const myToken = reloadTokenRef.current;
      const startedIdentityId = identityId;
      const startedContractId = contractId;
      try {
        const nextNotes = await listMyNotes({
          sdk,
          contractId,
          ownerId: identityId,
          log,
        });
        // Bail if a newer reload started, or session keys changed under us.
        if (
          reloadTokenRef.current !== myToken ||
          startedIdentityId !== identityId ||
          startedContractId !== contractId
        ) {
          return;
        }
        lastRevalidatedAt.current = Date.now();
        const changed = !notesEqualByRevision(prevNotes, nextNotes);
        if (changed) {
          setNotes(nextNotes);
          saveCachedNotes(identityId, contractId, NETWORK, nextNotes);
          // Reconcile the currently selected note. The list query already
          // returned full bodies, so we don't need an extra getNote.
          const sel = selectedIdRef.current;
          if (typeof sel === "string" && sel !== "new") {
            const before = prevNotes.find((n) => n.id === sel) ?? null;
            const after = nextNotes.find((n) => n.id === sel) ?? null;
            if (after && (!before || before.revision !== after.revision)) {
              const nextTitle = after.title ?? "";
              const nextMessage = after.message ?? "";
              const wasDirty =
                titleRef.current !== baselineTitleRef.current ||
                messageRef.current !== baselineMessageRef.current;
              setSelectedNote(after);
              setBaselineTitle(nextTitle);
              setBaselineMessage(nextMessage);
              if (!wasDirty) {
                setTitle(nextTitle);
                setMessage(nextMessage);
                setConflictWarning(null);
              } else {
                setConflictWarning(STALE_EDIT_WARNING);
              }
            } else if (after && !inFlightWriteRef.current) {
              setSelectedNote(after);
            }
          }
        }
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
        setEditsReady(true);
      } catch (err) {
        if (reloadTokenRef.current !== myToken) return;
        setError(errorMessage(err));
        if (!hadNotes) setNotes([]);
      } finally {
        if (reloadTokenRef.current === myToken) {
          setListLoading(false);
          setRevalidating(false);
        }
      }
    },
    [contractId, identityId, log, sdk, status, isDesktop],
  );

  // Hydrate from cache synchronously when identity/contract changes, then kick
  // off background revalidation. Resets edit gate so saves can't go out against
  // possibly-stale cached state until the chain confirms it.
  useEffect(() => {
    if (
      !identityId ||
      !contractId ||
      (status !== "authenticated" && status !== "browsing")
    ) {
      setNotes([]);
      setEditsReady(false);
      lastRevalidatedAt.current = 0;
      return;
    }
    const cached = loadCachedNotes(identityId, contractId, NETWORK);
    if (cached && cached.length > 0) {
      setNotes(cached);
      // Sync the ref immediately so the revalidation that runs in this same
      // turn sees `hadNotes=true` and won't wipe the list on a network error.
      notesRef.current = cached;
      // Auto-select the first cached note on desktop so the editor pane has
      // something to show before listMyNotes resolves. Mobile keeps the list
      // view as today.
      if (isDesktop && selectedIdRef.current === null) {
        setSelectedId(cached[0].id);
      }
    }
    setEditsReady(false);
    lastRevalidatedAt.current = 0;
    void reloadNotes();
    // reloadNotes intentionally omitted — it depends on `notes` and would
    // re-trigger this effect on every list change. `sdk` is in the deps so the
    // reload re-runs once a rehydrated session finishes connecting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityId, contractId, status, sdk]);

  const loadTokenRef = useRef(0);

  const loadNoteDetail = useCallback(
    async (noteId: string, hydrated: boolean) => {
      if (!sdk || !contractId) return;
      const token = ++loadTokenRef.current;
      if (!hydrated) setDetailLoading(true);
      try {
        const note = await getNote({ sdk, contractId, noteId, log });
        if (loadTokenRef.current !== token) return;
        setSelectedNote(note);
        if (!note) {
          setTitle("");
          setMessage("");
          setBaselineTitle("");
          setBaselineMessage("");
          return;
        }
        // Fold the fresh note back into the list (and cache) so previews,
        // ordering, and a future cold reload reflect the newest revision.
        const prev = notesRef.current;
        const idx = prev.findIndex((n) => n.id === note.id);
        if (idx === -1 || prev[idx].revision !== note.revision) {
          const merged =
            idx === -1
              ? [note, ...prev]
              : prev.map((n, i) => (i === idx ? note : n));
          setNotes(merged);
          if (identityId && contractId) {
            saveCachedNotes(identityId, contractId, NETWORK, merged);
          }
        }
        const nextTitle = note.title ?? "";
        const nextMessage = note.message ?? "";
        const priorBaselineTitle = baselineTitleRef.current;
        const priorBaselineMessage = baselineMessageRef.current;
        const wasDirty =
          titleRef.current !== priorBaselineTitle ||
          messageRef.current !== priorBaselineMessage;
        const chainChanged =
          nextTitle !== priorBaselineTitle ||
          nextMessage !== priorBaselineMessage;
        setBaselineTitle(nextTitle);
        setBaselineMessage(nextMessage);
        if (!wasDirty) {
          setTitle(nextTitle);
          setMessage(nextMessage);
          setConflictWarning(null);
        } else if (chainChanged) {
          setConflictWarning(STALE_EDIT_WARNING);
        }
      } catch (err) {
        if (loadTokenRef.current === token) setError(errorMessage(err));
      } finally {
        if (loadTokenRef.current === token) setDetailLoading(false);
      }
    },
    [contractId, identityId, log, sdk],
  );

  useEffect(() => {
    if (selectedId === "new") {
      setSelectedNote(null);
      setConflictWarning(null);
      return;
    }
    if (!selectedId || !sdk || !contractId) {
      setSelectedNote(null);
      return;
    }
    setConflictWarning(null);
    const cached =
      notesRef.current.find((note) => note.id === selectedId) ?? null;
    if (cached) {
      setSelectedNote(cached);
      setTitle(cached.title ?? "");
      setMessage(cached.message ?? "");
      setBaselineTitle(cached.title ?? "");
      setBaselineMessage(cached.message ?? "");
    }
    void loadNoteDetail(selectedId, Boolean(cached));
  }, [contractId, loadNoteDetail, sdk, selectedId]);

  // Background revalidation: refetch on tab focus (with throttle) and on a
  // periodic interval while the tab is visible. Dropped if a save/delete is
  // in flight to avoid clobbering post-write state with a pre-write list.
  useEffect(() => {
    if (
      !sdk ||
      !contractId ||
      !identityId ||
      (status !== "authenticated" && status !== "browsing")
    ) {
      return;
    }

    function maybeRefresh(throttleMs: number) {
      if (document.hidden) return;
      if (inFlightWriteRef.current) return;
      if (Date.now() - lastRevalidatedAt.current < throttleMs) return;
      void reloadNotes();
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        maybeRefresh(FOCUS_REFRESH_MIN_MS);
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(() => {
      maybeRefresh(BACKGROUND_REFRESH_MS - 1_000);
    }, BACKGROUND_REFRESH_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [sdk, contractId, identityId, status, reloadNotes]);

  function confirmDiscard(): boolean {
    if (!dirty) return true;
    return window.confirm("Discard unsaved changes?");
  }

  function handleSelect(noteId: string) {
    if (!confirmDiscard()) return;
    setSelectedId(noteId);
    setError(null);
    setConflictWarning(null);
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
    setConflictWarning(null);
  }

  function handleNew() {
    if (!canMutate) {
      // Browsing with a remembered identity: prompt the user to sign in so
      // they can author. Anonymous "idle" state never reaches this branch
      // because the button is hidden when the user can't even read.
      if (canRead) onOpenLogin();
      return;
    }
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
    inFlightWriteRef.current = true;
    // Snapshot what we're about to save — used for both the post-success
    // baseline advance and the post-failure refresh.
    const submittedTitle = title;
    const submittedMessage = message;
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
        // Advance baselines so the post-save reload doesn't see wasDirty=true
        // and trip the conflict detector against its own write.
        baselineTitleRef.current = submittedTitle;
        baselineMessageRef.current = submittedMessage;
        setBaselineTitle(submittedTitle);
        setBaselineMessage(submittedMessage);
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
        baselineTitleRef.current = submittedTitle;
        baselineMessageRef.current = submittedMessage;
        setBaselineTitle(submittedTitle);
        setBaselineMessage(submittedMessage);
        setConflictWarning(null);
        await loadNoteDetail(selectedId, true);
        await reloadNotes(selectedId);
      }
    } catch (err) {
      setError(errorMessage(err));
      // Save failed — chain may have moved (e.g. another window incremented
      // the identity nonce by saving first). Refresh the note so the user
      // sees what's actually on chain before they retry, and surface the
      // conflict warning if the revision actually moved past what we held.
      if (
        selectedId !== "new" &&
        selectedId !== null &&
        sdk &&
        contractId &&
        selectedNote
      ) {
        try {
          const latest = await getNote({
            sdk,
            contractId,
            noteId: selectedId,
            log,
          });
          if (latest && latest.revision !== selectedNote.revision) {
            setSelectedNote(latest);
            const latestTitle = latest.title ?? "";
            const latestMessage = latest.message ?? "";
            setBaselineTitle(latestTitle);
            setBaselineMessage(latestMessage);
            baselineTitleRef.current = latestTitle;
            baselineMessageRef.current = latestMessage;
            // The conflict warning is the actionable info ("your retry will
            // overwrite"); the underlying nonce/network error is internal
            // detail. Clear the error so the warning isn't masked.
            setError(null);
            // Fold the chain's content into the list/cache too.
            const prev = notesRef.current;
            const idx = prev.findIndex((n) => n.id === latest.id);
            if (idx === -1 || prev[idx].revision !== latest.revision) {
              const merged =
                idx === -1
                  ? [latest, ...prev]
                  : prev.map((n, i) => (i === idx ? latest : n));
              setNotes(merged);
              if (identityId && contractId) {
                saveCachedNotes(identityId, contractId, NETWORK, merged);
              }
            }
            setConflictWarning(STALE_EDIT_WARNING);
          }
        } catch {
          // Best effort — don't mask the original save error.
        }
      }
    } finally {
      inFlightWriteRef.current = false;
      setSaving(false);
    }
  }

  function requestDelete() {
    if (!sdk || !keyManager || !contractId || !isAuthed || !selectedId) return;
    if (selectedId === "new") {
      resetDraft();
      return;
    }
    setDeleteRequested(true);
  }

  async function confirmDelete() {
    if (!sdk || !keyManager || !contractId || !isAuthed || !selectedId) return;
    if (selectedId === "new") return;

    setDeleting(true);
    setError(null);
    inFlightWriteRef.current = true;
    try {
      await deleteNote({
        sdk,
        keyManager,
        contractId,
        noteId: selectedId,
        log,
      });
      setDeleteRequested(false);
      await reloadNotes();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      inFlightWriteRef.current = false;
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5 max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col max-md:space-y-2">
      {!canRead ? (
        <SignInHero onOpenLogin={onOpenLogin} />
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
          description="Open Settings to register a Dashnote note contract or paste a contract ID before creating notes."
          actionLabel="Open Settings"
          onAction={onOpenSettings}
        />
      ) : (
        <div className="gap-5 max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col md:grid md:h-[calc(100vh-175px)] md:min-h-[520px] md:grid-cols-[260px_minmax(0,1fr)] md:gap-0 md:overflow-hidden md:rounded-[24px] md:border md:border-line md:bg-surface md:shadow-[0_20px_60px_-36px_rgba(0,0,0,0.45)] lg:grid-cols-[340px_minmax(0,1fr)]">
          <div
            className={`min-h-0 max-md:flex-1 ${selectedId !== null ? "hidden md:flex" : "flex"} flex-col`}
          >
            <NoteList
              notes={notes}
              loading={listLoading}
              revalidating={revalidating && notes.length > 0}
              selectedId={selectedId}
              onSelect={handleSelect}
              onNew={handleNew}
              canCreate={canMutate || isBrowsing}
              newButtonLabel={canMutate ? "New note" : "Sign in to create"}
            />
          </div>
          <div
            className={`min-h-0 max-md:flex-1 ${selectedId === null ? "hidden md:flex" : "flex"} flex-col md:border-l md:border-line`}
          >
            <NoteEditor
              isDesktop={isDesktop}
              selectedId={selectedId}
              note={selectedNote}
              title={title}
              message={message}
              onTitleChange={setTitle}
              onMessageChange={setMessage}
              onSave={() => void handleSave()}
              onDelete={requestDelete}
              onBack={handleBack}
              loading={detailLoading}
              saving={saving}
              deleting={deleting}
              canEdit={canMutate}
              canDelete={Boolean(
                canMutate && selectedId && selectedId !== "new",
              )}
              isReadOnly={isBrowsing}
              dirty={dirty}
              messageBytes={messageBytes}
              messageOversize={messageOversize}
              contractReady={contractReady}
              contractId={contractId}
              error={error}
              conflictWarning={conflictWarning}
              onOpenLogin={onOpenLogin}
              onOpenSettings={onOpenSettings}
            />
          </div>
        </div>
      )}
      <DeleteNoteModal
        open={deleteRequested}
        noteTitle={title}
        deleting={deleting}
        onCancel={() => setDeleteRequested(false)}
        onConfirm={() => void confirmDelete()}
      />
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

function SignInHero({ onOpenLogin }: { onOpenLogin: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-line bg-surface px-12 py-14 max-md:flex max-md:flex-1 max-md:flex-col max-md:justify-center max-md:rounded-none max-md:border-0 max-md:px-6 max-md:py-10">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent)_22%,transparent),transparent_60%)]" />
      <div className="relative grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="max-md:text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
            Dash Platform tutorial
          </div>
          <h2 className="mt-3 text-balance text-[36px] font-bold leading-[1.05] tracking-[-0.025em] text-ink max-md:text-[28px]">
            Personal notes, stored on a public blockchain.
          </h2>
          <p className="mt-3 max-w-[440px] text-pretty text-[14.5px] leading-[1.6] text-ink-2 max-md:mx-auto">
            Dashnote stores notes against your testnet identity. Sign in with a
            Dash Platform identity to create, edit, and review your notes — or
            read the source to see how a small app registers a contract, writes
            documents, and queries them back.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5 max-md:justify-center">
            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-bg hover:bg-accent-dim"
            >
              Sign in
            </button>
            <a
              href="https://github.com/dashpay/platform-tutorials/tree/main/example-apps/dashnote"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-line-2 px-5 py-2.5 text-[13px] font-semibold text-ink-2 hover:border-accent-dim"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              View source
            </a>
          </div>
          <div className="mt-4 text-[12px] text-ink-4">
            Need a testnet identity?{" "}
            <a
              href="https://bridge.thepasta.org/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent underline-offset-2 hover:underline"
            >
              Create one on Dash Bridge →
            </a>
          </div>
        </div>

        {/* Sample note peek — mirrors the real NoteEditor (header pill + footer mono strip) */}
        <div className="relative max-lg:hidden" aria-hidden="true">
          <div className="overflow-hidden rounded-lg border border-line bg-bg shadow-[0_30px_70px_-36px_rgba(0,0,0,0.55)] [transform:rotate(-0.4deg)]">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[color:color-mix(in_oklab,var(--color-accent)_14%,transparent)] px-2.5 py-1 font-mono text-[11px] font-semibold text-accent">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Revision 4
              </span>
              <span className="text-[12px] text-ink-3">Updated last week</span>
            </div>
            <div className="px-5 py-4">
              <div className="text-[18px] font-bold tracking-[-0.015em] text-ink">
                Q4 product retro
              </div>
              <div className="mt-1.5 text-[13px] leading-[1.55] text-ink-2">
                Wins: shipped the tutorial app to staging, two contracts
                published, byte-budget editor unblocks long docs…
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line bg-surface/40 px-5 py-3 font-mono text-[10.5px] text-ink-4">
              <span>
                <span className="text-ink-3">$createdAt</span> 5/5/2026, 1:48 PM
              </span>
              <span>
                <span className="text-ink-3">$updatedAt</span> 5/5/2026, 4:43 PM
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
