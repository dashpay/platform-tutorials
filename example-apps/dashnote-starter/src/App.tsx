/**
 * Dashnote Starter — top-level component.
 *
 * Holds session state (sdk, keyManager, identityId, notes) and the four CRUD
 * handlers. Renders SignIn until authenticated, then the notes UI. Designed
 * to be readable top-to-bottom — no Context, no custom hooks, no router.
 *
 * Why dynamic imports for the SDK core? The @dashevo/evo-sdk bundle is ~8MB
 * (WASM). A static top-level import would block first paint. See
 * example-apps/dashnote/CLAUDE.md "Performance" section for the rules.
 */
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_CONTRACT_ID } from "./dash/contract";
import { createNote } from "./dash/createNote";
import { deleteNote } from "./dash/deleteNote";
import { listMyNotes, type NoteRecord } from "./dash/queries";
import type { DashKeyManager, DashSdk } from "./dash/types";
import { updateNote } from "./dash/updateNote";
import { errorMessage } from "./lib/logger";
import { NoteEditor } from "./components/NoteEditor";
import { NoteList } from "./components/NoteList";
import { SignIn } from "./components/SignIn";

type SdkCore = typeof import("../../../setupDashClient-core.mjs");

let sdkCorePromise: Promise<SdkCore> | null = null;
function loadSdkCore(): Promise<SdkCore> {
  if (!sdkCorePromise) {
    sdkCorePromise = import("../../../setupDashClient-core.mjs").catch(
      (err) => {
        sdkCorePromise = null;
        throw err;
      },
    );
  }
  return sdkCorePromise;
}

interface Session {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  identityId: string;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [editing, setEditing] = useState<NoteRecord | null>(null);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // Status is for the in-flight op. Dash helpers pass progress strings here
  // via `log`; we overwrite on each new op so old success messages don't
  // linger. Errors are set directly by the handlers (not via `log`) so they
  // outlive `setBusy(false)` until the next op starts.
  const log = useCallback((message: string) => {
    setStatus(message);
  }, []);

  async function handleSignIn(mnemonic: string) {
    setBusy(true);
    setStatus("Connecting…");
    try {
      const { createClient, IdentityKeyManager } = await loadSdkCore();
      const sdk = (await createClient("testnet")) as unknown as DashSdk;
      const keyManager = (await IdentityKeyManager.create({
        sdk: sdk as never,
        mnemonic,
        network: "testnet",
        identityIndex: 0,
      })) as unknown as DashKeyManager;
      const identityId = keyManager.identityId;
      if (!identityId) {
        throw new Error("No identity found for this mnemonic.");
      }
      setSession({ sdk, keyManager, identityId });
      setStatus("");
    } catch (err) {
      setStatus(`Sign-in failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  // Load the note list whenever the session becomes available.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const fetched = await listMyNotes({
          sdk: session.sdk,
          contractId: DEFAULT_CONTRACT_ID,
          ownerId: session.identityId,
          log,
        });
        if (!cancelled) {
          setNotes(fetched);
          setStatus("");
        }
      } catch (err) {
        if (!cancelled) setStatus(`Load failed: ${errorMessage(err)}`);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, log]);

  async function refresh() {
    if (!session) return;
    const fetched = await listMyNotes({
      sdk: session.sdk,
      contractId: DEFAULT_CONTRACT_ID,
      ownerId: session.identityId,
      log,
    });
    setNotes(fetched);
  }

  async function handleRefresh() {
    setBusy(true);
    setStatus("");
    try {
      await refresh();
      setStatus("");
    } catch (err) {
      setStatus(`Refresh failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(title: string, message: string) {
    if (!session) return;
    setBusy(true);
    setStatus("");
    try {
      await createNote({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: DEFAULT_CONTRACT_ID,
        title,
        message,
        log,
      });
      await refresh();
      setEditing(null);
      setStatus("");
    } catch (err) {
      setStatus(`Create failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(
    noteId: string,
    title: string,
    message: string,
    expectedRevision: number,
  ) {
    if (!session) return;
    setBusy(true);
    setStatus("");
    try {
      await updateNote({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: DEFAULT_CONTRACT_ID,
        noteId,
        title,
        message,
        expectedRevision,
        log,
      });
      await refresh();
      setEditing(null);
      setStatus("");
    } catch (err) {
      setStatus(`Update failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(noteId: string) {
    if (!session) return;
    if (!window.confirm("Delete this note?")) return;
    setBusy(true);
    setStatus("");
    try {
      await deleteNote({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: DEFAULT_CONTRACT_ID,
        noteId,
        log,
      });
      await refresh();
      setStatus("");
    } catch (err) {
      setStatus(`Delete failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  // Drop the session and let the keyManager closure (which holds the derived
  // keys) become garbage-collectable. The mnemonic itself was never lifted
  // into App state — it only lived in SignIn's local input.
  function handleSignOut() {
    setSession(null);
    setNotes([]);
    setEditing(null);
    setStatus("");
  }

  if (!session) {
    return <SignIn onSignIn={handleSignIn} busy={busy} status={status} />;
  }

  return (
    <main className="app">
      <header>
        <div className="row section-head">
          <h1>Dashnote Starter</h1>
          <button type="button" onClick={handleSignOut} disabled={busy}>
            Sign out
          </button>
        </div>
        <p className="identity">
          Identity:{" "}
          <a
            href={`https://testnet.platform-explorer.com/identity/${session.identityId}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            <code>{session.identityId}</code>
          </a>
        </p>
        <p className="identity">
          Contract:{" "}
          <a
            href={`https://testnet.platform-explorer.com/dataContract/${DEFAULT_CONTRACT_ID}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            <code>{DEFAULT_CONTRACT_ID}</code>
          </a>
        </p>
        {status && (
          <p className="status" aria-live="polite">
            {status}
          </p>
        )}
      </header>

      <section>
        <NoteEditor
          key={editing?.id ?? `new-${notes.length}`}
          note={editing}
          busy={busy}
          onCancel={editing ? () => setEditing(null) : undefined}
          onSubmit={(title, message) =>
            editing
              ? handleUpdate(editing.id, title, message, editing.revision)
              : handleCreate(title, message)
          }
        />
      </section>

      <section>
        <div className="row section-head">
          <h2>Your notes ({notes.length})</h2>
          <button type="button" onClick={handleRefresh} disabled={busy}>
            Refresh
          </button>
        </div>
        <NoteList
          notes={notes}
          onEdit={(note) => setEditing(note)}
          onDelete={handleDelete}
          disabled={busy}
        />
      </section>

      <footer>
        <p>
          Built on{" "}
          <a
            href="https://docs.dash.org/platform"
            target="_blank"
            rel="noreferrer noopener"
          >
            Dash Platform
          </a>{" "}
          with{" "}
          <a
            href="https://www.npmjs.com/package/@dashevo/evo-sdk"
            target="_blank"
            rel="noreferrer noopener"
          >
            @dashevo/evo-sdk
          </a>
          .
        </p>
        <p>
          <a
            href="https://github.com/dashpay/platform-tutorials/tree/main/example-apps/dashnote-starter"
            target="_blank"
            rel="noreferrer noopener"
          >
            View on GitHub
          </a>
        </p>
      </footer>
    </main>
  );
}
