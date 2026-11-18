import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "../session/useSession";
import {
  contractEntries,
  contractEntryCount,
  entriesByCategory,
  myEntries,
  publisherEntriesFor,
  publisherEntry,
  recentEntries,
  searchEntriesByName,
  type RegistryEntry,
} from "../dash/registryReads";
import {
  collapseByContract,
  endorsementsFor,
  officialListing,
  type OfficialListing,
} from "../dash/endorsementReads";
import { errorMessage } from "../lib/logger";
import {
  createMetadata,
  editMetadata,
  withdrawMetadata,
  type MetadataInput,
} from "../dash/registryWrites";
import { APP_CATEGORIES } from "../dash/registryReads";
import type { AppCategory } from "../dash/registryReads";
import { categoryLabel } from "../dash/categoryLabel";
import { DpnsName } from "./DpnsName";
import { SignInForm } from "./SignInForm";
import { ProvenanceIcon } from "./ProvenanceIcon";
import { ExternalLaunch } from "./ExternalLaunch";
import { ModalDialog } from "./ModalDialog";

function Entry({
  entry,
  open,
  officialPublisherId,
  showTags = false,
  showPublisher = true,
  onCategory,
  onEdit,
  editEntry,
}: {
  entry: RegistryEntry;
  open?: (id: string, name: string, entry: RegistryEntry) => void;
  officialPublisherId?: string;
  showTags?: boolean;
  showPublisher?: boolean;
  onCategory?: (category: AppCategory) => void;
  onEdit?: (entry: RegistryEntry) => void;
  editEntry?: RegistryEntry;
}) {
  const session = useSession();
  const official = entry.ownerId === officialPublisherId;
  const own = entry.ownerId === session.identityId;
  return (
    <article
      className={`registry-entry${open ? " interactive-entry" : ""}`}
      {...(open
        ? {
            role: "link",
            tabIndex: 0,
            "aria-label": `View details for ${entry.name}`,
            onClick: () => open(entry.contractId, entry.name, entry),
            onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open(entry.contractId, entry.name, entry);
              }
            },
          }
        : {})}
    >
      <span
        className="app-mark"
        data-category={entry.category}
        aria-hidden="true"
      >
        {entry.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="entry-copy">
        <div className="entry-title-line">
          {open ? (
            <button
              className="entry-title"
              onClick={(event) => {
                event.stopPropagation();
                open(entry.contractId, entry.name, entry);
              }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {entry.name}
            </button>
          ) : (
            <strong>{entry.name}</strong>
          )}
          {official && <ProvenanceIcon />}
          {own && <span className="entry-badge own">Your entry</span>}
          <button
            className="chip category-chip"
            onClick={(event) => {
              event.stopPropagation();
              onCategory?.(entry.category);
            }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {categoryLabel(entry.category)}
          </button>
        </div>
        <p>
          <span>{entry.tagline}</span>
          {showPublisher && (
            <>
              {" · "}
              {session.connection?.names ? (
                <DpnsName
                  identityId={entry.ownerId}
                  resolver={session.connection.names}
                />
              ) : (
                <code>
                  {entry.ownerId.slice(0, 6)}…{entry.ownerId.slice(-4)}
                </code>
              )}
            </>
          )}
        </p>
        {showTags && entry.tags.length > 0 && (
          <div className="entry-tags">
            {entry.tags.map((tag) => (
              <span className="chip" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="entry-links">
        {entry.appUrl && (
          <ExternalLaunch
            className="launch-pill"
            url={entry.appUrl}
            verified={official}
          >
            Launch ↗
          </ExternalLaunch>
        )}
        {editEntry && onEdit && (
          <button
            className="muted-pill"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(editEntry);
            }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            Edit
          </button>
        )}
        {open && (
          <button
            className="open-pill"
            onClick={(event) => {
              event.stopPropagation();
              open(entry.contractId, entry.name, entry);
            }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            Details
          </button>
        )}
      </div>
    </article>
  );
}

const NO_ENTRIES: RegistryEntry[] = [];

/** Contract ID → endorsed publisher ID for the contracts of loaded entries. */
function useOfficialPublishers(entries: RegistryEntry[]) {
  const session = useSession();
  const [officialPublishers, setOfficialPublishers] = useState(
    new Map<string, string>(),
  );
  useEffect(() => {
    let current = true;
    if (!session.connection || !session.registryId || entries.length === 0)
      return () => {
        current = false;
      };
    void endorsementsFor(
      session.connection.sdk,
      session.registryId,
      entries.map((entry) => entry.contractId),
    )
      .then((endorsements) => {
        if (!current) return;
        setOfficialPublishers(
          new Map(
            [...endorsements].map(([contractId, endorsement]) => [
              contractId,
              endorsement.publisherId,
            ]),
          ),
        );
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [entries, session.connection, session.registryId]);
  return officialPublishers;
}

export function ContractRegistry({
  contractId,
  onMutation,
  onPreferredEntry,
  onOfficialPublisher,
  managementHost,
}: {
  contractId: string;
  onMutation(): void;
  onPreferredEntry?(entry: RegistryEntry | null): void;
  onOfficialPublisher?(publisherId: string | null): void;
  managementHost?: HTMLElement | null;
}) {
  const session = useSession();
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [total, setTotal] = useState<bigint>();
  const [official, setOfficial] = useState<OfficialListing | null>();
  const [own, setOwn] = useState<RegistryEntry | null>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [moreBusy, setMoreBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  useEffect(() => {
    let current = true;
    if (!session.connection || !session.registryId) {
      return () => {
        current = false;
      };
    }
    void (async () => {
      try {
        const sdk = session.connection!.sdk;
        const [listings, officialResult, ownEntry, count] =
          await Promise.allSettled([
            contractEntries(sdk, session.registryId, contractId),
            officialListing(sdk, session.registryId, contractId),
            session.identityId
              ? publisherEntry(
                  sdk,
                  session.registryId,
                  session.identityId,
                  contractId,
                )
              : Promise.resolve(null),
            contractEntryCount(sdk, session.registryId, contractId),
          ]);
        if (!current) return;
        setError("");
        if (listings.status === "fulfilled") {
          setEntries(listings.value.entries);
          setCursor(listings.value.cursor);
        }
        if (officialResult.status === "fulfilled")
          setOfficial(officialResult.value);
        if (ownEntry.status === "fulfilled") setOwn(ownEntry.value);
        if (count.status === "fulfilled") setTotal(count.value);
        const preferred =
          officialResult.status === "fulfilled" && officialResult.value?.entry
            ? officialResult.value.entry
            : listings.status === "fulfilled"
              ? (listings.value.entries[0] ?? null)
              : null;
        setSelectedId(preferred?.id);
        onPreferredEntry?.(preferred);
        if (officialResult.status === "fulfilled")
          onOfficialPublisher?.(
            officialResult.value?.endorsement.publisherId ?? null,
          );
        const failures = [listings, officialResult, ownEntry, count]
          .filter(
            (result): result is PromiseRejectedResult =>
              result.status === "rejected",
          )
          .map((result) => errorMessage(result.reason));
        if (failures.length) setError([...new Set(failures)].join(" "));
      } catch (caught) {
        if (current) setError(errorMessage(caught));
      } finally {
        if (current) setBusy(false);
      }
    })();
    return () => {
      current = false;
    };
  }, [
    contractId,
    refresh,
    session.connection,
    session.identityId,
    session.registryId,
    onPreferredEntry,
    onOfficialPublisher,
  ]);
  async function loadMore() {
    if (!session.connection || !session.registryId || !cursor) return;
    setMoreBusy(true);
    try {
      const page = await contractEntries(
        session.connection.sdk,
        session.registryId,
        contractId,
        cursor,
      );
      setEntries((previous) => [
        ...new Map(
          [...previous, ...page.entries].map((entry) => [entry.id, entry]),
        ).values(),
      ]);
      setCursor(page.cursor);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setMoreBusy(false);
    }
  }
  if (!session.registryId)
    return <p>No registry is configured for this network.</p>;
  if (busy)
    return (
      <section
        className="registry-detail registry-detail-skeleton"
        aria-label="Community metadata"
        aria-busy="true"
      >
        <h3>Official metadata</h3>
        <div className="registry-entry skeleton-entry" aria-hidden="true">
          <span className="skeleton-block skeleton-mark" />
          <div className="skeleton-copy">
            <span className="skeleton-block skeleton-title" />
            <span className="skeleton-block skeleton-line" />
          </div>
          <span className="skeleton-block skeleton-action" />
        </div>
        <h3>Community proposals</h3>
        <span className="skeleton-block skeleton-message" aria-hidden="true" />
        <span className="sr-only" role="status">
          Loading registry entries…
        </span>
      </section>
    );
  const officialEntry = official?.entry ?? null;
  const community = entries.filter((entry) => entry.id !== officialEntry?.id);
  const communityTotal =
    total === undefined
      ? community.length
      : Number(total) - (officialEntry ? 1 : 0);
  const ordered = officialEntry ? [officialEntry, ...community] : entries;
  const selected =
    ordered.find((entry) => entry.id === selectedId) ?? ordered[0] ?? null;
  const choose = (entry: RegistryEntry) => {
    setSelectedId(entry.id);
    onPreferredEntry?.(entry);
  };
  if (ordered.length <= 1 && !error && !session.identityId) return null;
  const managementAction = (
    <>
      {session.identityId && (
        <div className="actions">
          <p>
            {own
              ? "You have submitted metadata for this contract."
              : own === null
                ? "You have no submission for this contract."
                : "Your submission could not be determined."}
          </p>
          {session.keyManager && own !== undefined && !editorOpen && (
            <button type="button" onClick={() => setEditorOpen(true)}>
              {own ? "Edit your submission" : "Add your entry"}
            </button>
          )}
        </div>
      )}
    </>
  );
  const editor =
    session.identityId &&
    session.keyManager &&
    own !== undefined &&
    editorOpen ? (
      <ModalDialog
        label={own ? "Edit your submission" : "Submit metadata"}
        onClose={() => setEditorOpen(false)}
      >
        <MetadataEditor
          key={`${own?.id ?? "new"}:${own?.revision ?? 0}`}
          entry={own}
          contractId={contractId}
          onCancel={() => setEditorOpen(false)}
          onChanged={() => {
            setEditorOpen(false);
            setBusy(true);
            setRefresh((value) => value + 1);
            onMutation();
          }}
        />
      </ModalDialog>
    ) : null;
  return (
    <section
      className="registry-detail listing-switcher"
      aria-label="App listings"
    >
      {error && (
        <p className="error" role="alert">
          Some registry entries could not be loaded: {error}
        </p>
      )}
      {ordered.length > 1 && (
        <>
          <div className="listing-switcher-bar">
            <p>
              <ProvenanceIcon /> Showing the{" "}
              <strong>
                {selected && selected.id === officialEntry?.id
                  ? "official"
                  : "community"}
              </strong>{" "}
              listing · {communityTotal} community{" "}
              {communityTotal === 1 ? "proposal" : "proposals"} also{" "}
              {communityTotal === 1 ? "exists" : "exist"}
            </p>
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Hide listings" : "Switch listing"}{" "}
              {expanded ? "▴" : "▾"}
            </button>
          </div>
          {expanded && (
            <div className="listing-options">
              {ordered.map((entry) => {
                const isOfficial = entry.id === officialEntry?.id;
                return (
                  <label
                    key={entry.id}
                    className={entry.id === selected?.id ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name="app-listing"
                      checked={entry.id === selected?.id}
                      onChange={() => choose(entry)}
                    />
                    <span
                      className="app-mark"
                      data-category={entry.category}
                      aria-hidden="true"
                    >
                      {entry.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      <strong>
                        {isOfficial
                          ? "Official publisher"
                          : entry.ownerId === session.identityId
                            ? "You"
                            : "Community member"}
                      </strong>
                      <small>
                        <DpnsName
                          identityId={entry.ownerId}
                          resolver={session.connection!.names}
                        />
                      </small>
                    </span>
                    <span>
                      <strong>
                        {entry.name} · {categoryLabel(entry.category)}
                      </strong>
                      <small>{entry.tagline}</small>
                    </span>
                    <span>
                      <small>
                        {entry.createdAt
                          ? new Date(
                              Number(entry.createdAt),
                            ).toLocaleDateString()
                          : "Date not provided"}
                        <br />
                        Rev {String(entry.revision)}
                      </small>
                    </span>
                  </label>
                );
              })}
              {cursor && (
                <button
                  type="button"
                  disabled={moreBusy}
                  onClick={() => void loadMore()}
                >
                  {moreBusy ? "Loading…" : "Load more listings"}
                </button>
              )}
              <p className="listing-note">
                The official listing is shown by default. Switching is local to
                this session.
              </p>
            </div>
          )}
        </>
      )}
      {managementHost
        ? createPortal(managementAction, managementHost)
        : managementAction}
      {managementHost && editor ? createPortal(editor, document.body) : editor}
    </section>
  );
}

function MetadataEditor({
  entry,
  contractId,
  onCancel,
  onChanged,
}: {
  entry: RegistryEntry | null;
  contractId: string;
  onCancel(): void;
  onChanged(): void;
}) {
  const session = useSession();
  const [input, setInput] = useState<MetadataInput>({
    name: entry?.name ?? "",
    tagline: entry?.tagline ?? "",
    category: entry?.category ?? "other",
    tags: entry?.tags.join(", ") ?? "",
    appUrl: entry?.appUrl ?? "",
    iconUrl: entry?.iconUrl ?? "",
    description: entry?.description ?? "",
    website: entry?.website ?? "",
    repository: entry?.repository ?? "",
    docs: entry?.docs ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  if (!session.connection || !session.keyManager || !session.registryId)
    return null;
  const change = (field: keyof MetadataInput, value: string) =>
    setInput((previous) => ({ ...previous, [field]: value }));
  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (entry)
        await editMetadata({
          sdk: session.connection!.sdk,
          keyManager: session.keyManager!,
          registryId: session.registryId,
          targetId: contractId,
          entry,
          input,
        });
      else
        await createMetadata({
          sdk: session.connection!.sdk,
          keyManager: session.keyManager!,
          registryId: session.registryId,
          targetId: contractId,
          input,
        });
      setNotice(entry ? "Metadata updated." : "Metadata submitted.");
      void session.refreshBalance().catch(() => undefined);
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  async function withdraw() {
    if (!entry) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await withdrawMetadata({
        sdk: session.connection!.sdk,
        keyManager: session.keyManager!,
        registryId: session.registryId,
        targetId: contractId,
        entry,
      });
      setNotice("Metadata withdrawn.");
      void session.refreshBalance().catch(() => undefined);
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="metadata-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h3>{entry ? "Edit your submission" : "Submit metadata"}</h3>
      <label>
        Name
        <input
          value={input.name}
          maxLength={63}
          required
          onChange={(event) => change("name", event.target.value)}
        />
      </label>
      <label>
        Tagline
        <input
          value={input.tagline}
          maxLength={120}
          required
          onChange={(event) => change("tagline", event.target.value)}
        />
      </label>
      <label>
        Category
        <select
          value={input.category}
          required
          onChange={(event) => change("category", event.target.value)}
        >
          {APP_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category.replaceAll("-", " ")}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tags
        <input
          value={input.tags}
          placeholder="wallet, payments"
          onChange={(event) => change("tags", event.target.value)}
        />
      </label>
      <label>
        Description
        <textarea
          value={input.description}
          maxLength={1000}
          onChange={(event) => change("description", event.target.value)}
        />
      </label>
      <label>
        App URL (optional)
        <input
          type="url"
          value={input.appUrl}
          maxLength={256}
          onChange={(event) => change("appUrl", event.target.value)}
        />
        <small>Only provide this when the contract has a launchable app.</small>
      </label>
      <label>
        Icon URL (optional)
        <input
          type="url"
          value={input.iconUrl}
          maxLength={256}
          placeholder="https://…"
          onChange={(event) => change("iconUrl", event.target.value)}
        />
        <small>
          When provided, it must use HTTPS. Dashapps does not load this URL
          directly.
        </small>
      </label>
      <label>
        Website
        <input
          type="url"
          value={input.website}
          maxLength={256}
          onChange={(event) => change("website", event.target.value)}
        />
      </label>
      <label>
        Repository
        <input
          type="url"
          value={input.repository}
          maxLength={256}
          onChange={(event) => change("repository", event.target.value)}
        />
      </label>
      <label>
        Documentation
        <input
          type="url"
          value={input.docs}
          maxLength={256}
          onChange={(event) => change("docs", event.target.value)}
        />
      </label>
      <div className="actions">
        <button disabled={busy}>
          {busy ? "Saving…" : entry ? "Save changes" : "Submit metadata"}
        </button>
        {entry && (
          <button
            className="danger"
            type="button"
            disabled={busy}
            onClick={() => void withdraw()}
          >
            Withdraw
          </button>
        )}
        <button type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}

export function RegistryExplorer({
  open,
  initialMode = "recent",
  showNavigation = true,
  heading,
  subheading,
  aside,
  onEntries,
  onOfficialPublishers,
  onCategory,
  showPublishers = true,
  showNetwork = true,
  initialEntries = [],
}: {
  open(id: string, name: string, entry: RegistryEntry): void;
  initialMode?: "recent" | "name" | "mine";
  showNavigation?: boolean;
  heading?: string;
  subheading?: string;
  aside?: React.ReactNode;
  onEntries?: (entries: RegistryEntry[]) => void;
  onOfficialPublishers?: (publishers: Map<string, string>) => void;
  onCategory?: (category: AppCategory) => void;
  showPublishers?: boolean;
  showNetwork?: boolean;
  initialEntries?: RegistryEntry[];
}) {
  const session = useSession();
  const [mode, setMode] = useState<"recent" | "name" | "mine">(initialMode);
  const [term, setTerm] = useState("");
  const [entries, setEntries] = useState<RegistryEntry[]>(initialEntries);
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RegistryEntry | null>(null);
  const ownEntriesScope = session.connection
    ? `${session.network}:${session.registryId}:${session.identityId ?? ""}`
    : "";
  const [ownEntriesResult, setOwnEntriesResult] = useState<{
    scope: string;
    entries: Map<string, RegistryEntry>;
  }>({ scope: "", entries: new Map() });
  const ownEntries =
    ownEntriesResult.scope === ownEntriesScope
      ? ownEntriesResult.entries
      : new Map<string, RegistryEntry>();
  const officialPublishers = useOfficialPublishers(entries);
  const request = useRef(0);

  const displayedEntries = useMemo(
    () => collapseByContract(entries, officialPublishers),
    [entries, officialPublishers],
  );
  useEffect(() => {
    let current = true;
    if (
      !session.connection ||
      !session.registryId ||
      !session.identityId ||
      entries.length === 0
    ) {
      return () => {
        current = false;
      };
    }
    void publisherEntriesFor(
      session.connection.sdk,
      session.registryId,
      session.identityId,
      entries.map((entry) => entry.contractId),
    )
      .then((result) => {
        if (current)
          setOwnEntriesResult({ scope: ownEntriesScope, entries: result });
      })
      .catch(() => {
        if (current)
          setOwnEntriesResult({ scope: ownEntriesScope, entries: new Map() });
      });
    return () => {
      current = false;
    };
  }, [
    entries,
    ownEntriesScope,
    session.connection,
    session.identityId,
    session.registryId,
  ]);
  useEffect(() => {
    onEntries?.(displayedEntries);
  }, [displayedEntries, onEntries]);
  useEffect(() => {
    onOfficialPublishers?.(officialPublishers);
  }, [officialPublishers, onOfficialPublishers]);

  async function load(selected = mode, more = false) {
    if (!session.connection || !session.registryId) return;
    const token = ++request.current;
    setBusy(true);
    setError("");
    try {
      const from = more ? cursor : undefined;
      let result;
      if (selected === "mine") {
        if (!session.identityId)
          throw new Error("Sign in to view your submissions.");
        result = await myEntries(
          session.connection.sdk,
          session.registryId,
          session.identityId,
          from,
        );
      } else
        result =
          selected === "recent"
            ? await recentEntries(
                session.connection.sdk,
                session.registryId,
                from,
              )
            : await searchEntriesByName(
                session.connection.sdk,
                session.registryId,
                term,
                from,
              );
      if (request.current === token) {
        setEntries((previous) =>
          more
            ? [
                ...new Map(
                  [...previous, ...result.entries].map((entry) => [
                    entry.id,
                    entry,
                  ]),
                ).values(),
              ]
            : result.entries,
        );
        setCursor(result.cursor);
      }
    } catch (caught) {
      if (request.current === token) setError(errorMessage(caught));
    } finally {
      if (request.current === token) setBusy(false);
    }
  }

  useEffect(() => {
    const generation = request;
    const timer =
      initialMode === "name"
        ? undefined
        : window.setTimeout(() => void load(initialMode), 0);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      generation.current++;
    };
    // load is intentionally event-oriented; connection/registry changes reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.connection, session.registryId, initialMode]);

  function choose(next: "recent" | "name" | "mine") {
    request.current++;
    setMode(next);
    setEntries([]);
    setCursor(undefined);
    setError("");
    if (next !== "name") void load(next);
  }
  return (
    <section className={`panel registry-panel registry-${mode}`}>
      <div className="panel-heading">
        <h2>
          {heading ??
            (mode === "mine"
              ? "Your entries"
              : mode === "name"
                ? "Search apps"
                : "Recently added")}
        </h2>
        {(subheading || showNetwork) && (
          <span>{subheading ?? session.network}</span>
        )}
      </div>
      {!session.registryId ? (
        <p>No registry is configured for this network.</p>
      ) : (
        <>
          {showNavigation && (
            <nav className="actions" aria-label="Registry views">
              <button
                aria-pressed={mode === "recent"}
                onClick={() => choose("recent")}
              >
                Recent
              </button>
              <button
                aria-pressed={mode === "name"}
                onClick={() => choose("name")}
              >
                Search names
              </button>
              <button
                aria-pressed={mode === "mine"}
                onClick={() => choose("mine")}
              >
                My submissions
              </button>
            </nav>
          )}
          {mode === "name" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void load("name");
              }}
            >
              <label htmlFor="registry-name">App name prefix</label>
              <div className="input-row">
                <input
                  id="registry-name"
                  placeholder="Search by app name"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                />
                <button disabled={busy}>Search</button>
              </div>
            </form>
          )}
          {busy && (
            <p role="status">
              {entries.length ? "Refreshing registry…" : "Loading registry…"}
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {!busy && !error && !displayedEntries.length && (
            <p>No registry entries found.</p>
          )}
          <div className={aside ? "registry-layout" : undefined}>
            <div>
              {displayedEntries.map((entry) => (
                <Entry
                  key={entry.id}
                  entry={entry}
                  open={open}
                  officialPublisherId={officialPublishers.get(entry.contractId)}
                  onCategory={onCategory}
                  showPublisher={showPublishers}
                  onEdit={session.keyManager ? setEditingEntry : undefined}
                  editEntry={ownEntries.get(entry.contractId)}
                />
              ))}
            </div>
            {aside && <aside className="registry-aside">{aside}</aside>}
          </div>
          {cursor && (
            <button disabled={busy} onClick={() => void load(mode, true)}>
              Load more
            </button>
          )}
          {editingEntry &&
            createPortal(
              <ModalDialog
                label="Edit your submission"
                onClose={() => setEditingEntry(null)}
              >
                <MetadataEditor
                  key={`${editingEntry.id}:${editingEntry.revision}`}
                  entry={editingEntry}
                  contractId={editingEntry.contractId}
                  onCancel={() => setEditingEntry(null)}
                  onChanged={() => {
                    setEditingEntry(null);
                    void load(mode);
                  }}
                />
              </ModalDialog>,
              document.body,
            )}
        </>
      )}
    </section>
  );
}

export function CategoryBrowser({
  category,
  open,
  onBack,
}: {
  category: AppCategory;
  open(id: string, name: string, entry: RegistryEntry): void;
  onBack(): void;
}) {
  const session = useSession();
  const [filter, setFilter] = useState<"all" | "launchable" | "official">(
    "all",
  );
  const scope =
    session.connection && session.registryId
      ? `${session.registryId}:${category}`
      : "";
  const [listing, setListing] = useState<{
    scope: string;
    entries: RegistryEntry[];
    cursor?: string;
    error: string;
    load: number;
  }>({ scope: "", entries: NO_ENTRIES, error: "", load: 0 });
  const listingCurrent = listing.scope === scope ? listing : undefined;
  const entries = listingCurrent?.entries ?? NO_ENTRIES;
  const cursor = listingCurrent?.cursor;
  const busy = Boolean(scope) && !listingCurrent;
  const request = useRef(0);
  const [more, setMore] = useState<{
    load: number;
    busy: boolean;
    error: string;
  }>({ load: -1, busy: false, error: "" });
  const moreCurrent =
    listingCurrent && more.load === listingCurrent.load ? more : undefined;
  const moreBusy = moreCurrent?.busy ?? false;
  const error = listingCurrent?.error || moreCurrent?.error || "";
  const officialPublishers = useOfficialPublishers(entries);
  const [signingIn, setSigningIn] = useState(false);
  useEffect(() => {
    let current = true;
    if (!session.connection || !session.registryId)
      return () => {
        current = false;
      };
    const load = ++request.current;
    void entriesByCategory(session.connection.sdk, session.registryId, category)
      .then((page) => {
        if (current)
          setListing({
            scope,
            entries: page.entries,
            cursor: page.cursor,
            error: "",
            load,
          });
      })
      .catch((caught) => {
        if (current)
          setListing({
            scope,
            entries: NO_ENTRIES,
            error: errorMessage(caught),
            load,
          });
      });
    return () => {
      current = false;
    };
  }, [category, scope, session.connection, session.registryId]);
  async function loadMore() {
    if (
      !session.connection ||
      !session.registryId ||
      !listingCurrent ||
      !cursor ||
      moreBusy
    )
      return;
    const { load } = listingCurrent;
    setMore({ load, busy: true, error: "" });
    try {
      const page = await entriesByCategory(
        session.connection.sdk,
        session.registryId,
        category,
        cursor,
      );
      if (load !== request.current) return;
      setListing((previous) =>
        previous.load !== load
          ? previous
          : {
              ...previous,
              entries: [
                ...new Map(
                  [...previous.entries, ...page.entries].map((entry) => [
                    entry.id,
                    entry,
                  ]),
                ).values(),
              ],
              cursor: page.cursor,
            },
      );
      setMore({ load, busy: false, error: "" });
    } catch (caught) {
      if (load === request.current)
        setMore({ load, busy: false, error: errorMessage(caught) });
    }
  }
  const collapsed = useMemo(
    () => collapseByContract(entries, officialPublishers),
    [entries, officialPublishers],
  );
  const visible = collapsed.filter(
    (entry) =>
      filter === "all" ||
      (filter === "launchable"
        ? Boolean(entry.appUrl)
        : entry.ownerId === officialPublishers.get(entry.contractId)),
  );
  return (
    <section className="category-page">
      <button className="back-link" onClick={onBack}>
        ← Discover
      </button>
      <div className="category-heading">
        <div>
          <p className="eyebrow">
            <span className="category-swatch" data-category={category} />{" "}
            CATEGORY
          </p>
          <h1>{categoryLabel(category)}</h1>
        </div>
        <div className="segment" aria-label="Category filter">
          {(["all", "launchable", "official"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === "official"
                ? "Official"
                : categoryLabel(value as AppCategory)}
            </button>
          ))}
        </div>
      </div>
      <p className="category-count">
        {`${visible.length}${cursor ? "+" : ""} ${
          visible.length === 1 && !cursor ? "app" : "apps"
        } in this category`}
      </p>
      {busy && <p role="status">Loading category…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {visible.map((entry) => (
        <Entry
          key={entry.id}
          entry={entry}
          open={open}
          officialPublisherId={officialPublishers.get(entry.contractId)}
          showTags
        />
      ))}
      {cursor && (
        <button disabled={moreBusy} onClick={() => void loadMore()}>
          {moreBusy ? "Loading…" : "Load more"}
        </button>
      )}
      {!session.identityId &&
        (signingIn ? (
          <div className="category-signin-form">
            <SignInForm onClose={() => setSigningIn(false)} />
          </div>
        ) : (
          <section className="signed-out-card category-signin">
            <span className="account-avatar">?</span>
            <div>
              <strong>
                Know a {categoryLabel(category).toLowerCase()} app that's
                missing?
              </strong>
              <small>
                Sign in to describe its contract — one entry per identity.
              </small>
            </div>
            <button
              className="sign-in-pill"
              disabled={!session.connection || session.network === "mainnet"}
              onClick={() => setSigningIn(true)}
            >
              Sign in
            </button>
          </section>
        ))}
    </section>
  );
}
