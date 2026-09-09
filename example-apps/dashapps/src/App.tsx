import { useCallback, useEffect, useRef, useState } from "react";
import { SessionProvider } from "./session/SessionContext";
import { useSession } from "./session/useSession";
import { SettingsView } from "./components/SettingsView";
import { SignInForm } from "./components/SignInForm";
import { IdentityChip } from "./components/IdentityChip";
import { DpnsName } from "./components/DpnsName";
import { ProvenanceIcon } from "./components/ProvenanceIcon";
import { ExternalLaunch } from "./components/ExternalLaunch";
import {
  CategoryBrowser,
  ContractRegistry,
  RegistryExplorer,
} from "./components/RegistryViews";
import type { RegistryEntry } from "./dash/registryReads";
import { categoryLabel } from "./dash/categoryLabel";
import { APP_CATEGORIES, type AppCategory } from "./dash/registryReads";
import type { Resolution } from "./dash/types";
import type { ContractSummary } from "./dash/contractSummaryStore";
import { contractFacts } from "./dash/contractFacts";
import { searchKeywords, shortDescription } from "./dash/keywordSearch";
import { requireId } from "./dash/ids";
import type { Network } from "./dash/types";

import { errorMessage as message } from "./lib/logger";
type Detail = ReturnType<typeof contractFacts>;
type View = "discover" | "search" | "mine" | "settings" | "add" | "category";
function Browser({
  view,
  navigate,
  category,
  chooseCategory,
  initialKeyword = "",
  cachedRegistryEntries,
  cacheRegistryEntries,
}: {
  view: Exclude<View, "settings">;
  navigate(view: View, keyword?: string): void;
  category?: AppCategory;
  chooseCategory(category: AppCategory): void;
  initialKeyword?: string;
  cachedRegistryEntries: RegistryEntry[];
  cacheRegistryEntries(entries: RegistryEntry[]): void;
}) {
  const { connection } = useSession();
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState(initialKeyword);
  const [term, setTerm] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [resolved, setResolved] = useState(new Map<string, Resolution>());
  const [summaries, setSummaries] = useState(
    new Map<string, ContractSummary>(),
  );
  const [searched, setSearched] = useState(false);
  const [target, setTarget] = useState("");
  const [selected, setSelected] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [detail, setDetail] = useState<Detail>();
  const [preferredEntry, setPreferredEntry] = useState<RegistryEntry | null>();
  const [description, setDescription] = useState<string>();
  const [descriptionError, setDescriptionError] = useState("");
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [registryRefresh, setRegistryRefresh] = useState(0);
  const discoverEntries = cachedRegistryEntries;
  const [discoverContractOwners, setDiscoverContractOwners] = useState(
    new Map<string, string>(),
  );
  const request = useRef(0);
  useEffect(() => {
    const generation = request;
    return () => {
      generation.current++;
      connection?.resolver.clear();
    };
  }, [connection]);
  async function search(more = false) {
    if (!connection) return;
    connection.resolver.clear();
    const token = ++request.current;
    const query = more ? term : keyword;
    setBusy(true);
    setError("");
    if (!more) {
      setIds([]);
      setCursor(undefined);
      setTerm(query);
      setSearched(true);
      setResolved(new Map());
    }
    try {
      const page = await searchKeywords(
        connection.sdk,
        query,
        more ? cursor : undefined,
      );
      if (request.current !== token) return;
      const cached = connection.resolver.summaryMany(page.ids);
      setIds((previous) => [
        ...new Set([...(more ? previous : []), ...page.ids]),
      ]);
      setSummaries(
        (previous) => new Map([...(more ? previous : []), ...cached]),
      );
      const contracts = await connection.resolver.resolve(page.ids);
      if (request.current !== token) return;
      if (more && page.cursor && page.cursor === cursor)
        throw new Error("Keyword cursor did not advance. Refresh the search.");
      setSummaries((previous) => {
        const next = new Map(more ? previous : []);
        for (const id of page.ids) {
          const summary = connection.resolver.summary(id);
          if (summary) next.set(id, summary);
        }
        return next;
      });
      setResolved(
        (previous) => new Map([...(more ? previous : []), ...contracts]),
      );
      setCursor(page.cursor);
    } catch (caught) {
      if (request.current === token) setError(message(caught));
    } finally {
      if (request.current === token) setBusy(false);
    }
  }
  useEffect(() => {
    const timer =
      view === "search" && initialKeyword
        ? window.setTimeout(() => void search(), 0)
        : undefined;
    // The browser remounts for navigation; run the transferred query once.
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function inspect(input: string, name = "", entry?: RegistryEntry) {
    if (!connection) return;
    connection.resolver.clear();
    const token = ++request.current;
    setBusy(true);
    setError("");
    let id: string;
    try {
      id = requireId(input.trim());
    } catch (error) {
      setBusy(false);
      setError(message(error));
      return;
    }
    const cached = connection.resolver.summary(id);
    setDetail(cached);
    if (entry) setPreferredEntry(entry);
    else if (id !== selected) setPreferredEntry(undefined);
    setDescription(undefined);
    setDescriptionError("");
    setMissing(false);
    setSelected(cached ? id : "");
    setSelectedName(name);
    try {
      const resolutions = await connection.resolver.resolve([id], true);
      if (request.current !== token) return;
      const resolution = resolutions.get(id)!;
      if (resolution.status === "error") throw resolution.error;
      setSelected(id);
      if (resolution.status === "missing") {
        setDetail(undefined);
        setMissing(true);
        return;
      }
      const facts = contractFacts(
        resolution.contract,
        connection.sdk.version(),
      );
      setDetail(facts);
      try {
        const declared = await shortDescription(connection.sdk, id);
        if (request.current === token) setDescription(declared);
      } catch (error) {
        if (request.current === token) setDescriptionError(message(error));
      }
    } catch (error) {
      if (request.current === token) setError(message(error));
    } finally {
      if (request.current === token) setBusy(false);
    }
  }
  if (selected) {
    const heading =
      preferredEntry?.name ||
      selectedName ||
      detail?.description ||
      "Platform app";
    const official = preferredEntry?.ownerId === detail?.ownerId;
    return (
      <section className="detail-page">
        <button
          className="back-link"
          onClick={() => {
            request.current++;
            setSelected("");
            setSelectedName("");
            setDetail(undefined);
            setMissing(false);
            setError("");
          }}
        >
          ← {view === "search" ? "Search" : "Discover"}
        </button>
        <div className="detail-hero">
          <span className="app-mark detail-mark" aria-hidden="true">
            {heading.slice(0, 1).toUpperCase()}
          </span>
          <div className="detail-copy">
            <div className="detail-title-row">
              <h1>{heading}</h1>
              {official && <ProvenanceIcon />}
            </div>
            {preferredEntry && (
              <p className="detail-publisher">
                by{" "}
                <DpnsName
                  identityId={preferredEntry.ownerId}
                  resolver={connection!.names}
                />
              </p>
            )}
            <p className="detail-summary">
              {missing
                ? "Contract not found on this network."
                : preferredEntry?.description || preferredEntry?.tagline
                  ? preferredEntry.description || preferredEntry.tagline
                  : description
                    ? description
                    : detail
                      ? `${detail.documentTypes.length} document ${detail.documentTypes.length === 1 ? "type" : "types"} declared on Dash Platform`
                      : "Loading contract details…"}
            </p>
            <div className="detail-links">
              {preferredEntry?.repository && (
                <a
                  href={preferredEntry.repository}
                  target="_blank"
                  rel="noreferrer"
                >
                  Repository ↗
                </a>
              )}
              {preferredEntry?.docs && (
                <a href={preferredEntry.docs} target="_blank" rel="noreferrer">
                  Docs ↗
                </a>
              )}
              <button
                type="button"
                title={selected}
                onClick={() => void navigator.clipboard?.writeText(selected)}
              >
                {selected.slice(0, 6)}…{selected.slice(-4)} · Copy
              </button>
            </div>
          </div>
          <div className="detail-hero-actions">
            {preferredEntry?.appUrl && (
              <ExternalLaunch
                className="primary-pill"
                url={preferredEntry.appUrl}
                verified={official}
              >
                Launch app
              </ExternalLaunch>
            )}
            {preferredEntry?.website && (
              <a
                className="primary-pill"
                href={preferredEntry.website}
                target="_blank"
                rel="noreferrer"
              >
                Visit website
              </a>
            )}
            <button
              className="refresh-pill secondary-pill"
              disabled={busy}
              onClick={() => void inspect(selected, heading)}
            >
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        <h2 className="sr-only">Declared by contract</h2>
        {detail && (
          <div className="detail-grid">
            <ContractRegistry
              contractId={selected}
              contractOwnerId={detail.ownerId}
              onMutation={() => setRegistryRefresh((value) => value + 1)}
              onPreferredEntry={setPreferredEntry}
            />
            <aside className="information">
              <h2>Information</h2>
              <dl>
                <dt>Summary</dt>
                <dd>
                  {descriptionError ? (
                    <span role="alert">
                      Could not load the short description: {descriptionError}{" "}
                      Use Refresh to retry.
                    </span>
                  ) : (
                    (description ?? "No short description declared.")
                  )}
                </dd>
                <dt>Publisher</dt>
                <dd>
                  <DpnsName
                    identityId={detail.ownerId}
                    resolver={connection!.names}
                  />
                </dd>
                <dt>Version</dt>
                <dd>{detail.version}</dd>
                <dt>Documents</dt>
                <dd>{detail.documentTypes.join(", ") || "None"}</dd>
                <dt>Keywords</dt>
                <dd>{detail.keywords.join(", ") || "None declared"}</dd>
                <dt>Owner</dt>
                <dd>
                  <code>{detail.ownerId}</code>
                </dd>
              </dl>
            </aside>
          </div>
        )}
      </section>
    );
  }
  if (view === "category" && category) {
    return (
      <CategoryBrowser
        category={category}
        onBack={() => navigate("discover")}
        open={(id, name, entry) => {
          setTarget(id);
          void inspect(id, name, entry);
        }}
      />
    );
  }
  const dashPay = discoverEntries.find(
    (entry) => entry.name.toLowerCase() === "dashpay" && entry.appUrl,
  );
  const featured =
    dashPay ??
    discoverEntries.find((entry) => entry.appUrl) ??
    discoverEntries[0];
  const alsoFeatured = discoverEntries
    .filter((entry) => entry.id !== featured?.id)
    .slice(0, 3);
  const launchable = discoverEntries
    .filter((entry) => Boolean(entry.appUrl))
    .slice(0, 4);
  const popularTags = [
    ...new Set(discoverEntries.flatMap((entry) => entry.tags)),
  ].slice(0, 6);
  const registryMatches = (() => {
    if (!searched) return [];
    const query = term.trim().toLowerCase();
    return discoverEntries.filter((entry) =>
      [entry.name, entry.tagline, entry.description ?? "", ...entry.tags].some(
        (value) => value.toLowerCase().includes(query),
      ),
    );
  })();
  const matchedContractIds = new Set(
    registryMatches.map((entry) => entry.contractId),
  );
  const keywordIds = ids.filter((id) => !matchedContractIds.has(id));
  return (
    <>
      {view === "discover" && (
        <section className="store-hero">
          <div>
            <p className="eyebrow">FEATURED</p>
            <h1>Built on Dash Platform</h1>
          </div>
          <button className="link-button" onClick={() => navigate("add")}>
            Add an app
          </button>
          <article className="feature-card feature-primary">
            <p className="eyebrow">
              {featured
                ? `${categoryLabel(featured.category).toUpperCase()} · FEATURED ENTRY`
                : "OPEN REGISTRY"}
            </p>
            <h2 className="featured-title">
              {featured?.name ?? "Discover Platform apps"}
              {featured &&
                featured.ownerId ===
                  discoverContractOwners.get(featured.contractId) && (
                  <ProvenanceIcon />
                )}
            </h2>
            <p>
              {featured?.tagline ??
                "Browse metadata submitted by contract owners and the community."}
            </p>
            <div className="feature-actions">
              <span
                className="app-mark large"
                data-category={featured?.category}
              >
                {featured?.name.slice(0, 1).toUpperCase() ?? "D"}
              </span>
              {featured?.appUrl && (
                <ExternalLaunch
                  className="feature-launch"
                  url={featured.appUrl}
                  verified={
                    featured.ownerId ===
                    discoverContractOwners.get(featured.contractId)
                  }
                >
                  Launch app ↗
                </ExternalLaunch>
              )}
              {featured && (
                <button
                  className="feature-details"
                  onClick={() =>
                    void inspect(featured.contractId, featured.name, featured)
                  }
                >
                  Details
                </button>
              )}
            </div>
          </article>
          <article className="feature-card feature-secondary">
            <p className="eyebrow">ALSO FEATURED</p>
            <div className="featured-list">
              {alsoFeatured.map((entry) => (
                <div className="featured-row" key={entry.id}>
                  <span className="app-mark" data-category={entry.category}>
                    {entry.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <span className="featured-title">
                      <strong>{entry.name}</strong>
                      {entry.ownerId ===
                        discoverContractOwners.get(entry.contractId) && (
                        <ProvenanceIcon />
                      )}
                    </span>
                    <small>{entry.tagline}</small>
                  </div>
                  <button
                    className="open-pill"
                    onClick={() =>
                      void inspect(entry.contractId, entry.name, entry)
                    }
                  >
                    Details
                  </button>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}
      {view === "search" && (
        <section className="page-heading">
          <h1>Search</h1>
        </section>
      )}
      {view === "mine" && (
        <section className="page-heading">
          <h1>Mine</h1>
          <p>Your registry submissions on this network.</p>
        </section>
      )}
      {view === "add" && (
        <section className="page-heading">
          <button className="back-link" onClick={() => navigate("discover")}>
            ← Discover
          </button>
          <h1>Add an app</h1>
          <p>
            Start with the Dash Platform data contract you want to describe.
          </p>
        </section>
      )}
      {(view === "search" || view === "discover") && (
        <form
          className="store-search"
          onSubmit={(event) => {
            event.preventDefault();
            if (view === "discover") {
              try {
                requireId(keyword.trim());
                void inspect(keyword);
              } catch {
                navigate("search", keyword);
              }
            } else void search();
          }}
        >
          <label className="sr-only" htmlFor="keyword">
            Discover by keyword
          </label>
          <div className="search-field">
            <input
              id="keyword"
              value={keyword}
              onChange={(event) => {
                request.current++;
                setBusy(false);
                setKeyword(event.target.value);
              }}
              placeholder={
                view === "discover"
                  ? "Search app names, or paste a 32-byte contract ID"
                  : "Search by keyword"
              }
            />
            <button
              aria-label={view === "discover" ? "Search apps" : "Search"}
              disabled={!keyword || busy}
            >
              {busy ? "Searching…" : "Search"}
            </button>
          </div>
        </form>
      )}
      {view === "discover" && (
        <>
          <section className="discover-section">
            <div className="panel-heading">
              <h2>Browse by category</h2>
              <span>16 categories</span>
            </div>
            <div className="category-grid">
              {APP_CATEGORIES.map((item) => (
                <button
                  className="category-tile"
                  key={item}
                  onClick={() => chooseCategory(item)}
                >
                  <span data-category={item} />
                  {categoryLabel(item)}
                </button>
              ))}
            </div>
          </section>
          <section className="discover-section">
            <div className="panel-heading">
              <h2>Launchable now</h2>
              <span>Entries that published an app URL</span>
            </div>
            <div className="shelf">
              {launchable.map((entry) => (
                <article
                  className="shelf-card"
                  key={entry.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`View details for ${entry.name}`}
                  onClick={() =>
                    void inspect(entry.contractId, entry.name, entry)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void inspect(entry.contractId, entry.name, entry);
                    }
                  }}
                >
                  <span
                    className="app-mark large"
                    data-category={entry.category}
                  >
                    {entry.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="shelf-copy">
                    <span className="featured-title">
                      <strong>{entry.name}</strong>
                      {entry.ownerId ===
                        discoverContractOwners.get(entry.contractId) && (
                        <ProvenanceIcon />
                      )}
                    </span>
                    <p>{entry.tagline}</p>
                    <button
                      className="chip category-chip"
                      onClick={(event) => {
                        event.stopPropagation();
                        chooseCategory(entry.category);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {categoryLabel(entry.category)}
                    </button>
                  </div>
                  <ExternalLaunch
                    className="launch-pill"
                    url={entry.appUrl!}
                    verified={
                      entry.ownerId ===
                      discoverContractOwners.get(entry.contractId)
                    }
                  >
                    Launch app ↗
                  </ExternalLaunch>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
      {view === "search" && searched && (
        <section className="search-results">
          <p>
            {registryMatches.length + keywordIds.length}{" "}
            {registryMatches.length + keywordIds.length === 1 ? "app" : "apps"}
            {" · keyword “"}
            {term}”
          </p>
          {registryMatches.map((entry) => (
            <article className="registry-entry" key={`registry:${entry.id}`}>
              <span className="app-mark" data-category={entry.category}>
                {entry.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="entry-copy">
                <button
                  className="entry-title"
                  onClick={() =>
                    void inspect(entry.contractId, entry.name, entry)
                  }
                >
                  {entry.name}
                </button>
                <small>{entry.tagline}</small>
              </div>
              <button
                className="open-pill"
                onClick={() =>
                  void inspect(entry.contractId, entry.name, entry)
                }
              >
                Open
              </button>
            </article>
          ))}
          {keywordIds.map((id) => {
            const result = resolved.get(id);
            const facts = summaries.get(id);
            return (
              <article className="registry-entry" key={id}>
                <span className="app-mark">
                  {facts?.description?.slice(0, 1).toUpperCase() || "?"}
                </span>
                <div className="entry-copy">
                  <button
                    className="entry-title"
                    onClick={() => void inspect(id)}
                  >
                    {facts?.description || id}
                  </button>
                  <small>
                    {facts
                      ? `${facts?.documentTypes.length ?? 0} document types`
                      : result?.status === "missing"
                        ? "Contract not found"
                        : "Lookup failed"}
                  </small>
                </div>
                <button className="open-pill" onClick={() => void inspect(id)}>
                  Open
                </button>
              </article>
            );
          })}
          {!registryMatches.length && !keywordIds.length && (
            <p>No apps found for this keyword.</p>
          )}
          {cursor && (
            <button
              className="open-pill"
              disabled={busy}
              onClick={() => void search(true)}
            >
              Show more
            </button>
          )}
        </section>
      )}
      {(view === "search" || view === "add") && (
        <div
          className={`tools contract-tools${view === "add" ? " add-contract" : ""}`}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void inspect(target);
            }}
          >
            <h2>
              {view === "add" ? "Data contract" : "Open a contract by ID"}
            </h2>
            <p>
              {view === "add"
                ? "Paste its 32-byte identifier. After it is verified, you can add your registry entry."
                : "Paste the 32-byte identifier of any data contract."}
            </p>
            <label className="sr-only" htmlFor="contract">
              Open a contract
            </label>
            <div className="input-row">
              <input
                id="contract"
                value={target}
                onChange={(event) => {
                  request.current++;
                  connection?.resolver.clear();
                  setBusy(false);
                  setTarget(event.target.value);
                }}
                placeholder="32-byte base58 contract ID"
              />
              <button disabled={!connection || busy}>
                {view === "add" ? "Continue" : "Open"}
              </button>
            </div>
          </form>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error} Retry the lookup when ready.
        </p>
      )}
      {(view === "discover" || view === "mine") && (
        <RegistryExplorer
          key={registryRefresh}
          initialMode={view === "mine" ? "mine" : "recent"}
          showNavigation={false}
          heading={view === "discover" ? "Recently added" : undefined}
          subheading={view === "discover" ? "Newest first" : undefined}
          onEntries={view === "discover" ? cacheRegistryEntries : undefined}
          onContractOwners={
            view === "discover" ? setDiscoverContractOwners : undefined
          }
          onCategory={chooseCategory}
          showPublishers={view !== "discover"}
          initialEntries={view === "discover" ? discoverEntries : undefined}
          aside={
            view === "discover" ? (
              <>
                <section className="panel describe-panel">
                  <h2>Describe a contract</h2>
                  <p>
                    Paste a contract ID to add your entry. One entry per
                    identity per contract.
                  </p>
                  <button
                    className="primary-pill"
                    onClick={() => navigate("add")}
                  >
                    Add an app
                  </button>
                </section>
                <section className="tag-panel">
                  <h2>Popular tags</h2>
                  <div>
                    {popularTags.map((tag) => (
                      <span className="chip" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              </>
            ) : undefined
          }
          open={(id, name, entry) => {
            setTarget(id);
            void inspect(id, name, entry);
          }}
        />
      )}
    </>
  );
}
function Shell() {
  const session = useSession();
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="./">
          <span className="brand-mark" aria-hidden="true" />
          dashapps
        </a>
      </header>
      <p className="sr-only" role="status">
        {session.status === "connecting"
          ? "Connecting to Platform…"
          : session.status === "error"
            ? "Connection unavailable"
            : session.status === "authenticated"
              ? "Connected · Signed in"
              : "Connected · Read-only"}
      </p>
      {session.error && (
        <p role="alert" className="error">
          {session.error}
        </p>
      )}
      {session.status === "error" && (
        <button onClick={session.reconnect}>Retry connection</button>
      )}
      <SessionViews />
      <footer>dashapps · An open source Dash Platform example</footer>
    </main>
  );
}
function SessionViews() {
  const session = useSession();
  const [view, setView] = useState<View>("discover");
  const [browserGeneration, setBrowserGeneration] = useState(0);
  const [category, setCategory] = useState<AppCategory>();
  const [browserKeyword, setBrowserKeyword] = useState("");
  const [registryEntries, setRegistryEntries] = useState<
    Record<Network, RegistryEntry[]>
  >({ testnet: [], mainnet: [] });
  const cacheRegistryEntries = useCallback(
    (entries: RegistryEntry[]) =>
      setRegistryEntries((cached) => ({
        ...cached,
        [session.network]: entries,
      })),
    [session.network],
  );
  function navigate(next: View, keyword = "") {
    setBrowserKeyword(keyword);
    setView(next);
    setBrowserGeneration((generation) => generation + 1);
  }
  function chooseCategory(next: AppCategory) {
    setCategory(next);
    navigate("category");
  }
  return (
    <>
      <nav className="app-nav" aria-label="App navigation">
        <button
          aria-pressed={view === "discover"}
          onClick={() => navigate("discover")}
        >
          Discover
        </button>
        <button
          aria-pressed={view === "search"}
          onClick={() => navigate("search")}
        >
          Search
        </button>
        <button aria-pressed={view === "mine"} onClick={() => navigate("mine")}>
          Mine
        </button>
        <button
          aria-pressed={view === "settings"}
          onClick={() => navigate("settings")}
        >
          Settings
        </button>
      </nav>
      {view === "settings" ? (
        <div className="settings-shell">
          <h1>Settings</h1>
          <Account
            key={`account:${session.network}:${session.connectionGeneration}:${session.registryGeneration}`}
          />
          <SettingsView
            key={`settings:${session.network}:${session.connectionGeneration}`}
          />
        </div>
      ) : (
        <Browser
          view={view}
          navigate={navigate}
          category={category}
          chooseCategory={chooseCategory}
          initialKeyword={browserKeyword}
          cachedRegistryEntries={registryEntries[session.network]}
          cacheRegistryEntries={cacheRegistryEntries}
          key={`browser:${session.network}:${session.connectionGeneration}:${session.registryGeneration}:${browserGeneration}:${category ?? ""}`}
        />
      )}
    </>
  );
}
function Account() {
  const session = useSession();
  const [signingIn, setSigningIn] = useState(false);
  if (session.identityId) return <IdentityChip key={session.identityId} />;
  if (session.network === "mainnet")
    return (
      <section className="signed-out-card">
        <span className="account-avatar">?</span>
        <div>
          <strong>Read-only</strong>
          <small>Switch to testnet to sign in.</small>
        </div>
      </section>
    );
  return signingIn ? (
    <SignInForm onClose={() => setSigningIn(false)} />
  ) : (
    <section className="signed-out-card">
      <span className="account-avatar">S</span>
      <div>
        <strong>Browse as guest</strong>
        <small>Sign in to manage your app entries.</small>
      </div>
      <button
        className="sign-in-pill"
        disabled={!session.connection}
        onClick={() => setSigningIn(true)}
      >
        Sign in
      </button>
    </section>
  );
}
export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
