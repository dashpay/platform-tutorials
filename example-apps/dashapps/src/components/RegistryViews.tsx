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
  myEndorsements,
  officialFeed,
  officialListing,
  officialListingOf,
  type OfficialListing,
} from "../dash/endorsementReads";
import { endorse, withdrawEndorsement } from "../dash/endorsementWrites";
import { ratingAverages, type RatingAverage } from "../dash/ratingReads";
import { HIGHLY_RATED_MIN_AVERAGE } from "../dash/leaderboard";
import { errorMessage } from "../lib/logger";
import { formatAverage, pluralize } from "../lib/format";
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
import { useInlineSignIn } from "../hooks/useInlineSignIn";
import { ProvenanceIcon } from "./ProvenanceIcon";
import { ExternalLaunch } from "./ExternalLaunch";
import { ModalDialog } from "./ModalDialog";

function EntryRating({ rating }: { rating: RatingAverage }) {
  return (
    <span className="entry-rating">
      {rating.count > 0n ? (
        <>
          ★ {formatAverage(rating.average)} ·{" "}
          {pluralize(rating.count, "review")}
        </>
      ) : (
        "No reviews yet"
      )}
    </span>
  );
}

function Entry({
  entry,
  open,
  officialPublisherId,
  provenanceKnown = false,
  rating,
  showTags = false,
  showPublisher = true,
  onCategory,
  onEdit,
  editEntry,
}: {
  entry: RegistryEntry;
  open?: (id: string, name: string, entry: RegistryEntry) => void;
  officialPublisherId?: string;
  provenanceKnown?: boolean;
  rating?: RatingAverage;
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
          {official && !provenanceKnown && <ProvenanceIcon />}
          {provenanceKnown &&
            (official ? (
              <span className="entry-badge official">
                <ProvenanceIcon />
                Official
              </span>
            ) : (
              <span className="entry-badge community">Community</span>
            ))}
          {own && <span className="entry-badge own">Your entry</span>}
          {rating && <EntryRating rating={rating} />}
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

/**
 * Contract ID → endorsed publisher ID for the contracts of loaded entries,
 * and the contracts already looked up (absent from the map: no endorsement).
 */
function useOfficialPublishers(entries: RegistryEntry[]) {
  const session = useSession();
  const [officialPublishers, setOfficialPublishers] = useState(
    new Map<string, string>(),
  );
  const [checked, setChecked] = useState(new Set<string>());
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
        setChecked(new Set(entries.map((entry) => entry.contractId)));
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [entries, session.connection, session.registryId]);
  return { officialPublishers, checked };
}

/** Average and review count per contract, one batched `average` per 100. */
function useRatingAverages(entries: RegistryEntry[]) {
  const session = useSession();
  const [averages, setAverages] = useState(new Map<string, RatingAverage>());
  useEffect(() => {
    let current = true;
    if (!session.connection || !session.registryId || entries.length === 0)
      return () => {
        current = false;
      };
    void ratingAverages(
      session.connection.sdk,
      session.registryId,
      entries.map((entry) => entry.contractId),
    )
      .then((result) => {
        if (current) setAverages(result);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [entries, session.connection, session.registryId]);
  return averages;
}

function OwnerPanel({
  contractId,
  official,
  listings,
  own,
  onChanged,
}: {
  contractId: string;
  official: OfficialListing | null | undefined;
  listings: RegistryEntry[];
  own: RegistryEntry | null | undefined;
  onChanged(notice: string): void;
}) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const publisherId = official?.endorsement.publisherId;
  const officialEntry = official?.entry ?? null;
  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError("");
    try {
      const notice = await action();
      void session.refreshBalance().catch(() => undefined);
      onChanged(notice);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  const makeOfficial = (entry: RegistryEntry) =>
    void run(async () => {
      const result = await endorse({
        sdk: session.connection!.sdk,
        keyManager: session.keyManager!,
        registryId: session.registryId,
        contractId,
        publisherId: entry.ownerId,
      });
      return result === "unchanged"
        ? "That listing is already official."
        : `${entry.name} is now the official listing.`;
    });
  const publisherName = (id: string) =>
    id === session.identityId ? (
      "you"
    ) : (
      <DpnsName identityId={id} resolver={session.connection!.names} nameOnly />
    );
  return (
    <section className="owner-panel" aria-label="Official listing">
      <p className="eyebrow">You own this contract</p>
      {officialEntry ? (
        <p>
          <ProvenanceIcon /> Official listing:{" "}
          <strong>{officialEntry.name}</strong>, published by{" "}
          {publisherName(officialEntry.ownerId)}.
        </p>
      ) : official ? (
        <p>
          The listing you marked official was withdrawn by its publisher, so
          nothing is official right now. Make another listing official, or
          withdraw the endorsement.
        </p>
      ) : own ? (
        <div className="owner-prompt">
          <p>
            <strong>Your entry isn't official yet.</strong> Until you mark it,
            it shows as a community listing.
          </p>
          <button
            type="button"
            className="primary-pill"
            disabled={busy || !session.keyManager}
            onClick={() => makeOfficial(own)}
          >
            {busy ? "Saving…" : "Mark as official"}
          </button>
        </div>
      ) : (
        <p>
          No listing is official yet.{" "}
          {listings.length
            ? "Make any listing official: yours or one a delegate published."
            : "Add your entry below, then mark it as official."}
        </p>
      )}
      {(official
        ? listings.length > 0
        : listings.some((entry) => entry.id !== own?.id)) && (
        <ul className="owner-listings">
          {listings.map((entry) => (
            <li key={entry.id}>
              <span
                className="app-mark"
                data-category={entry.category}
                aria-hidden="true"
              >
                {entry.name.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>{entry.name}</strong>
                <small>by {publisherName(entry.ownerId)}</small>
              </span>
              {entry.ownerId === publisherId ? (
                <span className="entry-badge">Official</span>
              ) : (
                <button
                  type="button"
                  className="muted-pill"
                  disabled={busy || !session.keyManager}
                  onClick={() => makeOfficial(entry)}
                >
                  Make official
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {official && (
        <button
          type="button"
          className="muted-pill danger"
          disabled={busy || !session.keyManager}
          onClick={() =>
            void run(async () => {
              await withdrawEndorsement({
                sdk: session.connection!.sdk,
                keyManager: session.keyManager!,
                registryId: session.registryId,
                endorsement: official.endorsement,
              });
              return "Endorsement withdrawn. Every listing is now a community listing.";
            })
          }
        >
          Withdraw endorsement
        </button>
      )}
      <small>
        &ldquo;Official&rdquo; only means the contract&apos;s owner chose it.
        The choice is its own document, so each change is one write.
      </small>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export function ContractRegistry({
  contractId,
  contractOwnerId,
  onMutation,
  onPreferredEntry,
  onOfficialPublisher,
  managementHost,
}: {
  contractId: string;
  contractOwnerId?: string;
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
  const [notice, setNotice] = useState("");
  const listedWhileOpen = useRef(false);
  const loadToken = useRef(0);
  useEffect(() => {
    let current = true;
    loadToken.current += 1;
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
        setOfficial(
          officialResult.status === "fulfilled"
            ? officialResult.value
            : undefined,
        );
        if (ownEntry.status === "fulfilled") setOwn(ownEntry.value);
        setTotal(count.status === "fulfilled" ? count.value : undefined);
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
    const token = loadToken.current;
    setMoreBusy(true);
    try {
      const page = await contractEntries(
        session.connection.sdk,
        session.registryId,
        contractId,
        cursor,
      );
      if (token !== loadToken.current) return;
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
  const dangling = Boolean(official && !official.entry);
  const isOwner =
    Boolean(session.identityId) && session.identityId === contractOwnerId;
  const reload = () => {
    listedWhileOpen.current = false;
    setBusy(true);
    setRefresh((value) => value + 1);
    onMutation();
  };
  if (ordered.length <= 1 && !error && !session.identityId && !dangling)
    return null;
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
          {session.keyManager && own !== undefined && (
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
        onClose={() => {
          setEditorOpen(false);
          if (listedWhileOpen.current) reload();
        }}
      >
        <MetadataEditor
          key={`${own?.id ?? "new"}:${own?.revision ?? 0}`}
          entry={own}
          contractId={contractId}
          onCancel={() => setEditorOpen(false)}
          onChanged={() => {
            setEditorOpen(false);
            reload();
          }}
          onListed={() => {
            listedWhileOpen.current = true;
          }}
          endorsed={Boolean(official)}
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
      {dangling && !isOwner && (
        <p className="listing-note">
          The contract owner&apos;s official listing was withdrawn by its
          publisher, so every listing here is a community listing.
        </p>
      )}
      {isOwner && (
        <OwnerPanel
          contractId={contractId}
          official={official}
          listings={ordered}
          own={own}
          onChanged={(message) => {
            setNotice(message);
            reload();
          }}
        />
      )}
      {notice && (
        <p className="listing-note" role="status">
          {notice}
        </p>
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
  onListed,
  endorsed = false,
}: {
  entry: RegistryEntry | null;
  contractId: string;
  onCancel(): void;
  onChanged(): void;
  endorsed?: boolean;
  /** The entry is saved but the editor stays open to offer endorsing it. */
  onListed?(): void;
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
  const [offerEndorse, setOfferEndorse] = useState(false);
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
      else {
        const { contractOwnerId } = await createMetadata({
          sdk: session.connection!.sdk,
          keyManager: session.keyManager!,
          registryId: session.registryId,
          targetId: contractId,
          input,
        });
        if (contractOwnerId === session.identityId && !endorsed) {
          void session.refreshBalance().catch(() => undefined);
          setOfferEndorse(true);
          onListed?.();
          return;
        }
      }
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
  async function markOfficial() {
    setBusy(true);
    setError("");
    try {
      await endorse({
        sdk: session.connection!.sdk,
        keyManager: session.keyManager!,
        registryId: session.registryId,
        contractId,
        publisherId: session.identityId!,
      });
      void session.refreshBalance().catch(() => undefined);
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  if (offerEndorse)
    return (
      <div className="metadata-form endorse-step">
        <p role="status">✓ Your entry is listed.</p>
        <p className="eyebrow">Step 2 of 2 · optional</p>
        <h3>Mark it as official?</h3>
        <p>
          You own this contract, so you can make your entry the official one.
          Until then it shows as a community listing. The endorsement is a
          separate document, so this is one more write.
        </p>
        <div className="actions">
          <button disabled={busy} onClick={() => void markOfficial()}>
            {busy ? "Saving…" : "Mark as official"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={onChanged}
          >
            Not now
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
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
  filters = false,
  highlyRated = null,
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
  /** Show the All / Official only switch and the 4★+ chip. */
  filters?: boolean;
  /** Contracts averaging 4★ or more; null until loaded. */
  highlyRated?: Set<string> | null;
}) {
  const session = useSession();
  const [mode, setMode] = useState<"recent" | "official" | "name" | "mine">(
    initialMode,
  );
  const [highOnly, setHighOnly] = useState(false);
  const [term, setTerm] = useState("");
  const [entries, setEntries] = useState<RegistryEntry[]>(initialEntries);
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(initialMode === "name");
  // Nothing is "not found" until a load has finished.
  const loading = busy || (!loaded && session.status !== "error");
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
  const { officialPublishers, checked } = useOfficialPublishers(entries);
  const averages = useRatingAverages(entries);
  const request = useRef(0);

  const displayedEntries = useMemo(
    () => collapseByContract(entries, officialPublishers),
    [entries, officialPublishers],
  );
  const highFilter = highOnly && highlyRated !== null;
  const visibleEntries = highFilter
    ? displayedEntries.filter((entry) => highlyRated.has(entry.contractId))
    : displayedEntries;
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
  // Discover's featured shelves are built from the full feed, never a filter.
  useEffect(() => {
    if (mode !== "official" && !busy) onEntries?.(displayedEntries);
  }, [busy, displayedEntries, mode, onEntries]);
  useEffect(() => {
    if (mode !== "official") onOfficialPublishers?.(officialPublishers);
  }, [mode, officialPublishers, onOfficialPublishers]);

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
      } else if (selected === "official") {
        const page = await officialFeed(
          session.connection.sdk,
          session.registryId,
          from,
        );
        result = {
          // A withdrawn entry leaves its endorsement with nothing to show.
          entries: page.listings.flatMap((listing) =>
            listing.entry ? [listing.entry] : [],
          ),
          cursor: page.cursor,
        };
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
      if (request.current === token) {
        setBusy(false);
        setLoaded(true);
      }
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

  function choose(next: "recent" | "official" | "name" | "mine") {
    request.current++;
    setMode(next);
    setEntries([]);
    setCursor(undefined);
    setError("");
    setLoaded(next === "name");
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
          <span>
            {mode === "official"
              ? "Chosen by contract owners · newest first"
              : (subheading ?? session.network)}
          </span>
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
          {filters && (
            <div className="feed-filters">
              <div className="segment" role="group" aria-label="Listing filter">
                <button
                  aria-pressed={mode === "recent"}
                  onClick={() => choose("recent")}
                >
                  All
                </button>
                <button
                  aria-pressed={mode === "official"}
                  onClick={() => choose("official")}
                >
                  Official only
                </button>
              </div>
              <button
                className="filter-chip"
                aria-pressed={highFilter}
                disabled={highlyRated === null}
                title={`Apps averaging ${HIGHLY_RATED_MIN_AVERAGE}★ or more, from one proven query`}
                onClick={() => setHighOnly((value) => !value)}
              >
                {HIGHLY_RATED_MIN_AVERAGE}★+
              </button>
              {highFilter && (
                <small>
                  {visibleEntries.length} of {displayedEntries.length} loaded
                  apps average {HIGHLY_RATED_MIN_AVERAGE}★ or more
                </small>
              )}
            </div>
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
          {loading && (
            <p role="status">
              {entries.length ? "Refreshing registry…" : "Loading registry…"}
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && !visibleEntries.length && (
            <p>
              {highFilter && displayedEntries.length
                ? `No loaded app averages ${HIGHLY_RATED_MIN_AVERAGE}★ or more yet.`
                : mode === "official"
                  ? cursor
                    ? "No official listings on this page."
                    : "No contract owner has marked a listing official yet."
                  : "No registry entries found."}
            </p>
          )}
          <div className={aside ? "registry-layout" : undefined}>
            <div>
              {visibleEntries.map((entry) => (
                <Entry
                  key={entry.id}
                  entry={entry}
                  open={open}
                  officialPublisherId={officialPublishers.get(entry.contractId)}
                  provenanceKnown={checked.has(entry.contractId)}
                  rating={averages.get(entry.contractId)}
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
  const { officialPublishers, checked } = useOfficialPublishers(entries);
  const averages = useRatingAverages(entries);
  const { signingIn, button, open: openSignIn, close } = useInlineSignIn();
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
          provenanceKnown={checked.has(entry.contractId)}
          rating={averages.get(entry.contractId)}
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
            <SignInForm onClose={close} />
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
              ref={button}
              onClick={openSignIn}
            >
              Sign in
            </button>
          </section>
        ))}
    </section>
  );
}

/** Contracts the signed-in identity has endorsed, with the entry each names. */
export function MyEndorsements({
  open,
}: {
  open(id: string, name: string, entry?: RegistryEntry): void;
}) {
  const session = useSession();
  const [listings, setListings] = useState<OfficialListing[]>();
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  async function load(from?: string) {
    if (!session.connection || !session.registryId || !session.identityId)
      return;
    const token = ++request.current;
    setBusy(true);
    setError("");
    try {
      const sdk = session.connection.sdk;
      const page = await myEndorsements(
        sdk,
        session.registryId,
        session.identityId,
        from,
      );
      const loaded = await Promise.all(
        page.endorsements.map((endorsement) =>
          officialListingOf(sdk, session.registryId, endorsement),
        ),
      );
      if (token !== request.current) return;
      setListings((previous) => [...(from ? (previous ?? []) : []), ...loaded]);
      setCursor(page.cursor);
    } catch (caught) {
      if (token === request.current) setError(errorMessage(caught));
    } finally {
      if (token === request.current) setBusy(false);
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const generation = request;
    return () => {
      window.clearTimeout(timer);
      generation.current++;
    };
    // load is event-oriented; a session change remounts the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.connection, session.registryId, session.identityId]);
  return (
    <section className="panel side-panel">
      <h2>Endorsed by you</h2>
      <p>Contracts you own, and the listing you marked official for each.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!listings && !error && <p role="status">Loading…</p>}
      {listings?.length === 0 && (
        <p>
          None yet. A contract&apos;s owner can mark one listing for it as
          official.
        </p>
      )}
      {listings && listings.length > 0 && (
        <ul className="side-list">
          {listings.map(({ endorsement, entry }) => (
            <li key={endorsement.id}>
              <button
                type="button"
                className="side-row"
                onClick={() =>
                  open(
                    endorsement.contractId,
                    entry?.name ?? "",
                    entry ?? undefined,
                  )
                }
              >
                <span className="side-row-title">
                  {entry?.name ??
                    `${endorsement.contractId.slice(0, 6)}…${endorsement.contractId.slice(-4)}`}
                  <small>
                    {!entry
                      ? "Entry withdrawn: re-point or withdraw"
                      : entry.ownerId === session.identityId
                        ? "Your entry"
                        : "A delegate's entry"}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {cursor && (
        <button
          className="open-pill"
          disabled={busy}
          onClick={() => void load(cursor)}
        >
          {busy ? "Loading…" : "Load more"}
        </button>
      )}
    </section>
  );
}
