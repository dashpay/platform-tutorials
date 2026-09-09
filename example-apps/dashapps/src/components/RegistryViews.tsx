import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../session/useSession";
import {
  allProposals,
  entriesByCategory,
  exactRegistryEntry,
  myEntries,
  recentEntries,
  searchEntriesByName,
  type RegistryEntry,
} from "../dash/registryReads";
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

function Entry({
  entry,
  open,
  contractOwnerId,
  showTags = false,
  showPublisher = true,
  onCategory,
}: {
  entry: RegistryEntry;
  open?: (id: string, name: string, entry: RegistryEntry) => void;
  contractOwnerId?: string;
  showTags?: boolean;
  showPublisher?: boolean;
  onCategory?: (category: AppCategory) => void;
}) {
  const session = useSession();
  const ownerProvided = entry.ownerId === contractOwnerId;
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
          {ownerProvided && <ProvenanceIcon />}
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
            verified={ownerProvided}
          >
            Launch ↗
          </ExternalLaunch>
        )}
        {entry.ownerId === session.identityId && open && (
          <button
            className="muted-pill"
            onClick={(event) => {
              event.stopPropagation();
              open(entry.contractId, entry.name, entry);
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

function canonicalEntries(
  entries: RegistryEntry[],
  contractOwners: Map<string, string>,
) {
  const byContract = new Map<string, RegistryEntry>();
  for (const entry of entries) {
    const current = byContract.get(entry.contractId);
    if (!current) {
      byContract.set(entry.contractId, entry);
      continue;
    }
    const contractOwner = contractOwners.get(entry.contractId);
    const entryIsOwnerProvided = entry.ownerId === contractOwner;
    const currentIsOwnerProvided = current.ownerId === contractOwner;
    if (entryIsOwnerProvided && !currentIsOwnerProvided)
      byContract.set(entry.contractId, entry);
    else if (
      entryIsOwnerProvided === currentIsOwnerProvided &&
      (entry.createdAt ?? 0n) > (current.createdAt ?? 0n)
    )
      byContract.set(entry.contractId, entry);
  }
  return [...byContract.values()];
}

export function ContractRegistry({
  contractId,
  contractOwnerId,
  onMutation,
  onPreferredEntry,
}: {
  contractId: string;
  contractOwnerId: string;
  onMutation(): void;
  onPreferredEntry?(entry: RegistryEntry | null): void;
}) {
  const session = useSession();
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [canonical, setCanonical] = useState<RegistryEntry | null>();
  const [own, setOwn] = useState<RegistryEntry | null>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  useEffect(() => {
    let current = true;
    if (!session.connection || !session.registryId) {
      return () => {
        current = false;
      };
    }
    void (async () => {
      try {
        const [proposals, ownerEntry, ownEntry] = await Promise.allSettled([
          allProposals(session.connection!.sdk, session.registryId, contractId),
          exactRegistryEntry(
            session.connection!.sdk,
            session.registryId,
            contractOwnerId,
            contractId,
          ),
          session.identityId
            ? exactRegistryEntry(
                session.connection!.sdk,
                session.registryId,
                session.identityId,
                contractId,
              )
            : Promise.resolve(null),
        ]);
        if (!current) return;
        setError("");
        if (proposals.status === "fulfilled") setEntries(proposals.value);
        if (ownerEntry.status === "fulfilled") setCanonical(ownerEntry.value);
        if (ownEntry.status === "fulfilled") setOwn(ownEntry.value);
        onPreferredEntry?.(
          ownerEntry.status === "fulfilled" && ownerEntry.value
            ? ownerEntry.value
            : proposals.status === "fulfilled"
              ? (proposals.value[0] ?? null)
              : null,
        );
        const failures = [proposals, ownerEntry, ownEntry]
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
    contractOwnerId,
    refresh,
    session.connection,
    session.identityId,
    session.registryId,
    onPreferredEntry,
  ]);
  if (!session.registryId)
    return <p>No registry is configured for this network.</p>;
  if (busy)
    return (
      <section
        className="registry-detail registry-detail-skeleton"
        aria-label="Community metadata"
        aria-busy="true"
      >
        <h3>Canonical metadata</h3>
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
  const community = entries.filter((entry) => entry.id !== canonical?.id);
  return (
    <section className="registry-detail" aria-label="Community metadata">
      {error && (
        <p className="error" role="alert">
          Some registry entries could not be loaded: {error}
        </p>
      )}
      <h3>Canonical metadata</h3>
      {canonical ? (
        <Entry entry={canonical} contractOwnerId={contractOwnerId} />
      ) : canonical === null ? (
        <p>The contract owner has not submitted metadata.</p>
      ) : (
        <p>Canonical metadata could not be determined.</p>
      )}
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
      {session.identityId &&
        session.keyManager &&
        own !== undefined &&
        editorOpen && (
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
        )}
      <h3>Community proposals</h3>
      {!community.length ? (
        <p>No community proposals.</p>
      ) : (
        <div>
          {community.map((entry) => (
            <Entry
              key={entry.id}
              entry={entry}
              contractOwnerId={contractOwnerId}
            />
          ))}
        </div>
      )}
      <small>
        {entries.length} complete registry{" "}
        {entries.length === 1 ? "entry" : "entries"} loaded.
      </small>
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
  onContractOwners,
  onCategory,
  showPublishers = true,
  initialEntries = [],
}: {
  open(id: string, name: string, entry: RegistryEntry): void;
  initialMode?: "recent" | "name" | "mine";
  showNavigation?: boolean;
  heading?: string;
  subheading?: string;
  aside?: React.ReactNode;
  onEntries?: (entries: RegistryEntry[]) => void;
  onContractOwners?: (owners: Map<string, string>) => void;
  onCategory?: (category: AppCategory) => void;
  showPublishers?: boolean;
  initialEntries?: RegistryEntry[];
}) {
  const session = useSession();
  const [mode, setMode] = useState<"recent" | "name" | "mine">(initialMode);
  const [term, setTerm] = useState("");
  const [entries, setEntries] = useState<RegistryEntry[]>(initialEntries);
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [contractOwners, setContractOwners] = useState(() => {
    if (!session.connection) return new Map<string, string>();
    const ids = [...new Set(initialEntries.map((entry) => entry.contractId))];
    return new Map(
      [...session.connection.resolver.summaryMany(ids)].map(([id, summary]) => [
        id,
        summary.ownerId,
      ]),
    );
  });
  const request = useRef(0);

  const displayedEntries = useMemo(
    () => canonicalEntries(entries, contractOwners),
    [entries, contractOwners],
  );
  useEffect(() => {
    onEntries?.(displayedEntries);
  }, [displayedEntries, onEntries]);
  useEffect(() => {
    let current = true;
    if (!session.connection || entries.length === 0)
      return () => {
        current = false;
      };
    const ids = [...new Set(entries.map((entry) => entry.contractId))];
    const cachedOwners = new Map(
      [...session.connection.resolver.summaryMany(ids)].map(([id, summary]) => [
        id,
        summary.ownerId,
      ]),
    );
    if (cachedOwners.size) {
      void Promise.resolve().then(() => {
        if (!current) return;
        setContractOwners(cachedOwners);
        onContractOwners?.(cachedOwners);
      });
    }
    void session.connection.resolver
      .resolve(ids)
      .then((results) => {
        if (!current) return;
        const owners = new Map<string, string>();
        for (const [id, result] of results)
          if (result.status === "found") owners.set(id, result.ownerId);
        setContractOwners(owners);
        onContractOwners?.(owners);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [entries, onContractOwners, session.connection]);

  async function load(selected = mode, more = false) {
    if (!session.connection || !session.registryId) return;
    const token = ++request.current;
    setBusy(true);
    setError("");
    try {
      if (selected === "mine") {
        if (!session.identityId)
          throw new Error("Sign in to view your submissions.");
        const result = await myEntries(
          session.connection.sdk,
          session.registryId,
          session.identityId,
        );
        if (request.current === token) {
          setEntries(result);
          setCursor(undefined);
        }
      } else {
        const result =
          selected === "recent"
            ? await recentEntries(
                session.connection.sdk,
                session.registryId,
                more ? cursor : undefined,
              )
            : await searchEntriesByName(
                session.connection.sdk,
                session.registryId,
                term,
                more ? cursor : undefined,
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
        <span>{subheading ?? session.network}</span>
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
                  contractOwnerId={contractOwners.get(entry.contractId)}
                  onCategory={onCategory}
                  showPublisher={showPublishers}
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
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "launchable" | "official">(
    "all",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(
    Boolean(session.connection && session.registryId),
  );
  const [contractOwners, setContractOwners] = useState(
    new Map<string, string>(),
  );
  const [signingIn, setSigningIn] = useState(false);
  useEffect(() => {
    let current = true;
    if (!session.connection || !session.registryId)
      return () => {
        current = false;
      };
    void entriesByCategory(session.connection.sdk, session.registryId, category)
      .then((page) => {
        if (current) setEntries(page.entries);
      })
      .catch((caught) => {
        if (current) setError(errorMessage(caught));
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [category, session.connection, session.registryId]);
  useEffect(() => {
    let current = true;
    if (!session.connection || entries.length === 0)
      return () => {
        current = false;
      };
    const ids = [...new Set(entries.map((entry) => entry.contractId))];
    const cachedOwners = new Map(
      [...session.connection.resolver.summaryMany(ids)].map(([id, summary]) => [
        id,
        summary.ownerId,
      ]),
    );
    if (cachedOwners.size)
      void Promise.resolve().then(() => {
        if (current) setContractOwners(cachedOwners);
      });
    void session.connection.resolver
      .resolve(ids)
      .then((results) => {
        if (!current) return;
        const owners = new Map<string, string>();
        for (const [id, result] of results)
          if (result.status === "found") owners.set(id, result.ownerId);
        setContractOwners(owners);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [entries, session.connection]);
  const canonical = useMemo(
    () => canonicalEntries(entries, contractOwners),
    [entries, contractOwners],
  );
  const visible = canonical.filter(
    (entry) =>
      filter === "all" ||
      (filter === "launchable"
        ? Boolean(entry.appUrl)
        : entry.ownerId === contractOwners.get(entry.contractId)),
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
                ? "Owner-provided"
                : categoryLabel(value as AppCategory)}
            </button>
          ))}
        </div>
      </div>
      <p className="category-count">
        {visible.length} {visible.length === 1 ? "app" : "apps"} in this
        category
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
          contractOwnerId={contractOwners.get(entry.contractId)}
          showTags
        />
      ))}
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
