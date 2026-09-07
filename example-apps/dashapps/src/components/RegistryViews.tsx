import { useEffect, useRef, useState } from "react";
import { useSession } from "../session/useSession";
import {
  allProposals,
  exactRegistryEntry,
  myEntries,
  recentEntries,
  searchEntriesByName,
  type RegistryEntry,
} from "../dash/registryReads";
import { errorMessage } from "../lib/logger";
import { createMetadata, editMetadata, withdrawMetadata, type MetadataInput } from "../dash/registryWrites";

function Entry({ entry, open }: { entry: RegistryEntry; open?: (id: string) => void }) {
  return (
    <article className="registry-entry">
      {open ? <button className="contract-link" onClick={() => open(entry.contractId)}>{entry.name}</button> : <strong>{entry.name}</strong>}
      <code>{entry.contractId}</code>
      {entry.description && <p>{entry.description}</p>}
      <div className="entry-links">
        {entry.website && <a href={entry.website} target="_blank" rel="noreferrer">Website</a>}
        {entry.repository && <a href={entry.repository} target="_blank" rel="noreferrer">Repository</a>}
        {entry.docs && <a href={entry.docs} target="_blank" rel="noreferrer">Docs</a>}
      </div>
      <small>Submitted by {entry.ownerId}</small>
    </article>
  );
}

export function ContractRegistry({
  contractId,
  contractOwnerId,
  onMutation,
}: {
  contractId: string;
  contractOwnerId: string;
  onMutation(): void;
}) {
  const session = useSession();
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [canonical, setCanonical] = useState<RegistryEntry | null>();
  const [own, setOwn] = useState<RegistryEntry | null>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    if (!session.connection || !session.registryId) {
      return () => { current = false; };
    }
    void (async () => {
      try {
        const [proposals, ownerEntry, ownEntry] = await Promise.allSettled([
          allProposals(session.connection!.sdk, session.registryId, contractId),
          exactRegistryEntry(session.connection!.sdk, session.registryId, contractOwnerId, contractId),
          session.identityId
            ? exactRegistryEntry(session.connection!.sdk, session.registryId, session.identityId, contractId)
            : Promise.resolve(null),
        ]);
        if (!current) return;
        setError("");
        if (proposals.status === "fulfilled") setEntries(proposals.value);
        if (ownerEntry.status === "fulfilled") setCanonical(ownerEntry.value);
        if (ownEntry.status === "fulfilled") setOwn(ownEntry.value);
        const failures = [proposals, ownerEntry, ownEntry]
          .filter((result): result is PromiseRejectedResult => result.status === "rejected")
          .map((result) => errorMessage(result.reason));
        if (failures.length) setError([...new Set(failures)].join(" "));
      } catch (caught) {
        if (current) setError(errorMessage(caught));
      } finally {
        if (current) setBusy(false);
      }
    })();
    return () => { current = false; };
  }, [contractId, contractOwnerId, refresh, session.connection, session.identityId, session.registryId]);
  if (!session.registryId) return <p>No registry is configured for this network.</p>;
  if (busy) return <p role="status">Loading registry entries…</p>;
  const community = entries.filter((entry) => entry.id !== canonical?.id);
  return (
    <section className="registry-detail" aria-label="Community metadata">
      {error && <p className="error" role="alert">Some registry entries could not be loaded: {error}</p>}
      <h3>Canonical metadata</h3>
      {canonical ? <Entry entry={canonical} /> : canonical === null ? <p>The contract owner has not submitted metadata.</p> : <p>Canonical metadata could not be determined.</p>}
      {session.identityId && <p>{own ? "You have submitted metadata for this contract." : own === null ? "You have no submission for this contract." : "Your submission could not be determined."}</p>}
      {session.identityId && session.keyManager && own !== undefined && (
        <MetadataEditor
          key={`${own?.id ?? "new"}:${own?.revision ?? 0}`}
          entry={own}
          contractId={contractId}
          onChanged={() => {
            setBusy(true);
            setRefresh((value) => value + 1);
            onMutation();
          }}
        />
      )}
      <h3>Community proposals</h3>
      {!community.length ? <p>No community proposals.</p> : <div>{community.map((entry) => <Entry key={entry.id} entry={entry} />)}</div>}
      <small>{entries.length} complete registry {entries.length === 1 ? "entry" : "entries"} loaded.</small>
    </section>
  );
}

function MetadataEditor({ entry, contractId, onChanged }: { entry: RegistryEntry | null; contractId: string; onChanged(): void }) {
  const session = useSession();
  const [input, setInput] = useState<MetadataInput>({
    name: entry?.name ?? "",
    description: entry?.description ?? "",
    website: entry?.website ?? "",
    repository: entry?.repository ?? "",
    docs: entry?.docs ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  if (!session.connection || !session.keyManager || !session.registryId) return null;
  const change = (field: keyof MetadataInput, value: string) => setInput((previous) => ({ ...previous, [field]: value }));
  async function save() {
    setBusy(true); setError(""); setNotice("");
    try {
      if (entry) await editMetadata({ sdk: session.connection!.sdk, keyManager: session.keyManager!, registryId: session.registryId, targetId: contractId, entry, input });
      else await createMetadata({ sdk: session.connection!.sdk, keyManager: session.keyManager!, registryId: session.registryId, targetId: contractId, input });
      setNotice(entry ? "Metadata updated." : "Metadata submitted.");
      void session.refreshBalance().catch(() => undefined);
      onChanged();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }
  async function withdraw() {
    if (!entry) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await withdrawMetadata({ sdk: session.connection!.sdk, keyManager: session.keyManager!, registryId: session.registryId, targetId: contractId, entry });
      setNotice("Metadata withdrawn.");
      void session.refreshBalance().catch(() => undefined);
      onChanged();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }
  return (
    <form className="metadata-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <h3>{entry ? "Edit your submission" : "Submit metadata"}</h3>
      <label>Name<input value={input.name} maxLength={63} required onChange={(event) => change("name", event.target.value)} /></label>
      <label>Description<textarea value={input.description} maxLength={1000} onChange={(event) => change("description", event.target.value)} /></label>
      <label>Website<input type="url" value={input.website} maxLength={256} onChange={(event) => change("website", event.target.value)} /></label>
      <label>Repository<input type="url" value={input.repository} maxLength={256} onChange={(event) => change("repository", event.target.value)} /></label>
      <label>Documentation<input type="url" value={input.docs} maxLength={256} onChange={(event) => change("docs", event.target.value)} /></label>
      <div className="actions"><button disabled={busy}>{busy ? "Saving…" : entry ? "Save changes" : "Submit metadata"}</button>{entry && <button className="danger" type="button" disabled={busy} onClick={() => void withdraw()}>Withdraw</button>}</div>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}

export function RegistryExplorer({ open }: { open(id: string): void }) {
  const session = useSession();
  const [mode, setMode] = useState<"recent" | "name" | "mine">("recent");
  const [term, setTerm] = useState("");
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);

  async function load(selected = mode, more = false) {
    if (!session.connection || !session.registryId) return;
    const token = ++request.current;
    setBusy(true); setError("");
    try {
      if (selected === "mine") {
        if (!session.identityId) throw new Error("Sign in to view your submissions.");
        const result = await myEntries(session.connection.sdk, session.registryId, session.identityId);
        if (request.current === token) { setEntries(result); setCursor(undefined); }
      } else {
        const result = selected === "recent"
          ? await recentEntries(session.connection.sdk, session.registryId, more ? cursor : undefined)
          : await searchEntriesByName(session.connection.sdk, session.registryId, term, more ? cursor : undefined);
        if (request.current === token) {
          setEntries((previous) => more ? [...new Map([...previous, ...result.entries].map((entry) => [entry.id, entry])).values()] : result.entries);
          setCursor(result.cursor);
        }
      }
    } catch (caught) {
      if (request.current === token) setError(errorMessage(caught));
    } finally {
      if (request.current === token) setBusy(false);
    }
  }

  useEffect(() => {
    const generation = request;
    const timer = window.setTimeout(() => void load("recent"), 0);
    return () => {
      window.clearTimeout(timer);
      generation.current++;
    };
    // load is intentionally event-oriented; connection/registry changes reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.connection, session.registryId]);

  function choose(next: "recent" | "name" | "mine") {
    request.current++; setMode(next); setEntries([]); setCursor(undefined); setError("");
    if (next !== "name") void load(next);
  }
  return (
    <section className="panel">
      <div className="panel-heading"><h2>Registry</h2><span>{session.network}</span></div>
      {!session.registryId ? <p>No registry is configured for this network.</p> : <>
        <nav className="actions" aria-label="Registry views">
          <button aria-pressed={mode === "recent"} onClick={() => choose("recent")}>Recent</button>
          <button aria-pressed={mode === "name"} onClick={() => choose("name")}>Search names</button>
          <button aria-pressed={mode === "mine"} onClick={() => choose("mine")}>My submissions</button>
        </nav>
        {mode === "name" && <form onSubmit={(event) => { event.preventDefault(); void load("name"); }}>
          <label htmlFor="registry-name">App name prefix</label>
          <div className="input-row"><input id="registry-name" value={term} onChange={(event) => setTerm(event.target.value)} /><button disabled={busy}>Search</button></div>
        </form>}
        {busy && <p role="status">Loading registry…</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {!busy && !error && !entries.length && <p>No registry entries found.</p>}
        <div>{entries.map((entry) => <Entry key={entry.id} entry={entry} open={open} />)}</div>
        {cursor && <button disabled={busy} onClick={() => void load(mode, true)}>Load more</button>}
      </>}
    </section>
  );
}
