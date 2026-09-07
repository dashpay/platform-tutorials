import { useEffect, useRef, useState } from "react";
import { SessionProvider } from "./session/SessionContext";
import { useSession } from "./session/useSession";
import { SettingsView } from "./components/SettingsView";
import { SignInForm } from "./components/SignInForm";
import { IdentityChip } from "./components/IdentityChip";
import { DpnsName } from "./components/DpnsName";
import { ContractRegistry, RegistryExplorer } from "./components/RegistryViews";
import type { Resolution } from "./dash/types";
import { contractFacts } from "./dash/contractFacts";
import { searchKeywords, shortDescription } from "./dash/keywordSearch";
import { requireId } from "./dash/ids";
import type { Network } from "./dash/types";

import { errorMessage as message } from "./lib/logger";
type Detail = ReturnType<typeof contractFacts>;
function Browser() {
  const { connection } = useSession();
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("registry");
  const [term, setTerm] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [resolved, setResolved] = useState(new Map<string, Resolution>());
  const [searched, setSearched] = useState(false);
  const [target, setTarget] = useState("");
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<Detail>();
  const [description, setDescription] = useState<string>();
  const [descriptionError, setDescriptionError] = useState("");
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [registryRefresh, setRegistryRefresh] = useState(0);
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
    setBusy(true);
    setError("");
    setDetail(undefined);
    setMissing(false);
    setSelected("");
    if (!more) {
      setIds([]);
      setCursor(undefined);
      setSearched(false);
      setResolved(new Map());
    }
    try {
      const query = more ? term : keyword;
      const page = await searchKeywords(
        connection.sdk,
        query,
        more ? cursor : undefined,
      );
      if (request.current !== token) return;
      const contracts = await connection.resolver.resolve(page.ids);
      if (request.current !== token) return;
      if (more && page.cursor && page.cursor === cursor)
        throw new Error("Keyword cursor did not advance. Refresh the search.");
      setIds((previous) => [
        ...new Set([...(more ? previous : []), ...page.ids]),
      ]);
      setResolved(
        (previous) => new Map([...(more ? previous : []), ...contracts]),
      );
      setCursor(page.cursor);
      setTerm(query);
      setSearched(true);
    } catch (error) {
      if (request.current === token) setError(message(error));
    } finally {
      if (request.current === token) setBusy(false);
    }
  }
  async function inspect(input: string) {
    if (!connection) return;
    connection.resolver.clear();
    const token = ++request.current;
    setBusy(true);
    setError("");
    setDetail(undefined);
    setDescription(undefined);
    setDescriptionError("");
    setMissing(false);
    setSelected("");
    try {
      const id = requireId(input.trim());
      setSelected(id);
      const resolutions = await connection.resolver.resolve([id], true);
      if (request.current !== token) return;
      const resolution = resolutions.get(id)!;
      if (resolution.status === "error") throw resolution.error;
      if (resolution.status === "missing") {
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
  return (
    <>
      <section className="intro">
        <p className="eyebrow">DASH PLATFORM / CONTRACT DIRECTORY</p>
        <h1>
          Discover what’s built
          <br />
          on Platform.
        </h1>
        <p>
          Explore contract keywords and inspect metadata declared by each
          contract.
        </p>
      </section>
      <div className="tools">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <label htmlFor="keyword">Discover by keyword</label>
          <div className="input-row">
            <input
              id="keyword"
              value={keyword}
              onChange={(event) => {
                request.current++;
                connection?.resolver.clear();
                setBusy(false);
                setKeyword(event.target.value);
              }}
              placeholder="registry, apps, dapps"
            />
            <button disabled={!connection || busy}>Search</button>
          </div>
          <small>Exact keyword match; input is lowercased.</small>
        </form>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void inspect(target);
          }}
        >
          <label htmlFor="contract">Open a contract</label>
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
            <button disabled={!connection || busy}>Open</button>
          </div>
          <small>Contract IDs are specific to the selected network.</small>
        </form>
      </div>
      {error && (
        <p className="error" role="alert">
          {error} Retry the lookup when ready.
        </p>
      )}
      {busy && <p role="status">Loading…</p>}
      {selected && (
        <section className="panel">
          <div className="panel-heading">
            <h2>Declared by contract</h2>
            <button disabled={busy} onClick={() => void inspect(selected)}>
              Refresh
            </button>
          </div>
          <code>{selected}</code>
          {missing && (
            <p role="status">
              Contract not found on this network (deleted or never existed).
              Canonical metadata cannot be determined.
            </p>
          )}
          {detail && (
            <>
              <p>{detail.description || "No description declared."}</p>
              <dl>
                <dt>Owner</dt>
                <dd>
                  <DpnsName
                    identityId={detail.ownerId}
                    resolver={connection!.names}
                  />
                </dd>
                <dt>Version</dt>
                <dd>{detail.version}</dd>
                <dt>Keywords</dt>
                <dd>{detail.keywords.join(", ") || "None declared"}</dd>
                <dt>Document types</dt>
                <dd>{detail.documentTypes.join(", ") || "None"}</dd>
                <dt>Keyword Search description</dt>
                <dd>
                  {descriptionError ? (
                    <span role="alert">
                      Could not load the short description: {descriptionError}{" "}
                      Use Refresh to retry.
                    </span>
                  ) : busy ? (
                    "Loading short description…"
                  ) : (
                    (description ?? "No short description declared.")
                  )}
                </dd>
              </dl>
              <ContractRegistry
                contractId={selected}
                contractOwnerId={detail.ownerId}
                onMutation={() => setRegistryRefresh((value) => value + 1)}
              />
            </>
          )}
        </section>
      )}
      {searched && (
        <section className="panel">
          <h2>Keyword results</h2>
          <p>
            {ids.length} unique contracts loaded ·{" "}
            {cursor ? "More results available" : "Search complete"}
          </p>
          {!ids.length && <p>No contracts found for this keyword.</p>}
          <ul>
            {ids.map((id) => (
              <li key={id}>
                <button
                  className="contract-link"
                  onClick={() => void inspect(id)}
                >
                  {id}
                </button>
                <p>
                  {resolved.get(id)?.status === "found"
                    ? "Contract found · Open to inspect declared metadata"
                    : resolved.get(id)?.status === "missing"
                      ? "Contract not found on this network"
                      : "Contract lookup failed · Open to retry"}
                </p>
              </li>
            ))}
          </ul>
          {cursor && (
            <button disabled={busy} onClick={() => void search(true)}>
              Load more
            </button>
          )}
        </section>
      )}
      <RegistryExplorer
        key={registryRefresh}
        open={(id) => {
          setTarget(id);
          void inspect(id);
        }}
      />
    </>
  );
}
function Shell() {
  const session = useSession();
  return (
    <main>
      <header>
        <a className="brand" href="./">
          dash<span>apps</span>
        </a>
        <label>
          Network{" "}
          <select
            aria-label="Network"
            value={session.network}
            onChange={(event) =>
              session.setNetwork(event.target.value as Network)
            }
          >
            <option value="testnet">testnet</option>
            <option value="mainnet">mainnet</option>
          </select>
        </label>
      </header>
      <p className="connection" role="status">
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
  const [view, setView] = useState<"discover" | "settings">("discover");
  return (
    <>
      <nav className="actions" aria-label="App navigation">
        <button
          aria-pressed={view === "discover"}
          onClick={() => setView("discover")}
        >
          Discover
        </button>
        <button
          aria-pressed={view === "settings"}
          onClick={() => setView("settings")}
        >
          Settings
        </button>
      </nav>
      <Account
        key={`account:${session.network}:${session.connectionGeneration}:${session.registryGeneration}`}
      />
      {view === "settings" ? (
        <SettingsView
          key={`settings:${session.network}:${session.connectionGeneration}`}
        />
      ) : (
        <Browser
          key={`browser:${session.network}:${session.connectionGeneration}:${session.registryGeneration}`}
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
    return <p>Mainnet is read-only. Switch to testnet to sign in.</p>;
  return signingIn ? (
    <SignInForm onClose={() => setSigningIn(false)} />
  ) : (
    <button disabled={!session.connection} onClick={() => setSigningIn(true)}>
      Sign in
    </button>
  );
}
export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
