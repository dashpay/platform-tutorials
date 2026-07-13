import { useEffect, useMemo, useRef, useState } from "react";

import { CopyableId } from "./CopyableId";
import { IdentityLabel } from "./IdentityLabel";
import { groupDisplay } from "../dash/groupDisplay";
import {
  fetchTokenOpsGovernance,
  type RuleAuthority,
  type RuleInfo,
  type TokenOpsGovernance,
} from "../dash/governance";
import {
  listActionSigners,
  listPendingActions,
  type PendingAction,
} from "../dash/groupActions";
import { errorMessage } from "../dash/logger";
import {
  fetchIdentityTokenStates,
  fetchTokenOverview,
  type TokenSupplyConfig,
} from "../dash/token";
import { useDpnsNames } from "../hooks/useDpnsNames";
import { shortId } from "../lib/format";
import { useSession } from "../session/useSession";

type TokenOverview = {
  tokenId: string;
  totalSupply: bigint;
  isPaused: boolean;
  metadata: { name: string; description: string };
  supplyConfig: TokenSupplyConfig;
};

type IdentityTokenState = {
  identityId: string;
  balance: bigint;
  isFrozen: boolean;
};

const SHORT_CAPABILITY_LABEL: Record<string, string> = {
  manualMinting: "Mint",
  manualBurning: "Burn",
  freeze: "Freeze",
  unfreeze: "Unfreeze",
  destroyFrozenFunds: "Destroy frozen funds",
  emergencyAction: "Pause / resume",
};

function formatAmount(value: bigint): string {
  return value.toLocaleString("en-US");
}

function actionRuleKey(action: PendingAction): string | null {
  switch (action.params?.kind) {
    case "mint":
      return "manualMinting";
    case "burn":
      return "manualBurning";
    case "freeze":
      return "freeze";
    case "unfreeze":
      return "unfreeze";
    case "destroyFrozen":
      return "destroyFrozenFunds";
    case "emergency":
      return "emergencyAction";
    default:
      return null;
  }
}

function isCurrentlyActionable(
  action: PendingAction,
  groupPosition: number,
  governance: TokenOpsGovernance,
): boolean {
  const ruleKey = actionRuleKey(action);
  if (!ruleKey) return false;
  const rule = governance.rules.find((candidate) => candidate.key === ruleKey);
  return (
    rule?.operator.type === "Group" &&
    rule.operator.groupPosition === groupPosition
  );
}

type AuthorityCard = {
  key: string;
  title: string;
  meta: string;
  accent: string;
  capabilities: RuleInfo[];
};

function authorityKey(authority: RuleAuthority): string {
  if (authority.type === "Group") {
    return `group:${authority.groupPosition ?? "unknown"}`;
  }
  if (authority.type === "Identity") {
    return `identity:${authority.identityId ?? "unknown"}`;
  }
  return authority.type;
}

function authorityCard(
  authority: RuleAuthority,
  governance: TokenOpsGovernance,
): Omit<AuthorityCard, "capabilities"> {
  if (authority.type === "Group") {
    const position = authority.groupPosition;
    const group = governance.groups.find(
      (candidate) => candidate.groupPosition === position,
    );
    const display = groupDisplay(position ?? 0, governance.rules);
    return {
      key: authorityKey(authority),
      title: `Group ${position ?? "?"}`,
      meta: group
        ? `${group.members.size} ${group.members.size === 1 ? "member" : "members"} · ${group.requiredPower} signers required`
        : "Group details unavailable",
      accent: display.accent,
    };
  }

  switch (authority.type) {
    case "ContractOwner":
      return {
        key: authorityKey(authority),
        title: "Contract owner",
        meta: "Controlled directly by the data contract owner",
        accent: "blue",
      };
    case "Identity":
      return {
        key: authorityKey(authority),
        title: `Identity ${shortId(authority.identityId, 6)}`,
        meta: "Controlled directly by this identity",
        accent: "teal",
      };
    case "MainGroup":
      return {
        key: authorityKey(authority),
        title: "Main control group",
        meta: "Delegated to the contract's main group",
        accent: "purple",
      };
    case "NoOne":
      return {
        key: authorityKey(authority),
        title: "No one",
        meta: "These capabilities are disabled",
        accent: "red",
      };
    default:
      return {
        key: authorityKey(authority),
        title: "Unknown authority",
        meta: "Authority could not be resolved",
        accent: "gray",
      };
  }
}

function authorityCards(governance: TokenOpsGovernance): AuthorityCard[] {
  const cards = new Map<string, AuthorityCard>();

  for (const rule of governance.rules.filter(
    (candidate) => candidate.supportsGroupAction,
  )) {
    const key = authorityKey(rule.operator);
    const existing = cards.get(key);
    if (existing) {
      existing.capabilities.push(rule);
      continue;
    }
    cards.set(key, {
      ...authorityCard(rule.operator, governance),
      capabilities: [rule],
    });
  }

  return [...cards.values()];
}

export function OverviewView({
  onNavigateToPending,
  onNavigateToGovernance,
}: {
  onNavigateToPending: () => void;
  onNavigateToGovernance: () => void;
}) {
  const session = useSession();
  const [overview, setOverview] = useState<TokenOverview | null>(null);
  const [governance, setGovernance] = useState<TokenOpsGovernance | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [needsSignatureCount, setNeedsSignatureCount] = useState<number | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [identityInspectorOpen, setIdentityInspectorOpen] = useState(false);
  const identityInspectorContext = useRef<string | null>(null);
  const [identityInspectorLoading, setIdentityInspectorLoading] =
    useState(false);
  const [identityInspectorError, setIdentityInspectorError] = useState<
    string | null
  >(null);
  const [identityLookupId, setIdentityLookupId] = useState("");
  const [identityRows, setIdentityRows] = useState<
    Map<string, IdentityTokenState>
  >(new Map());

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (!session.sdk || !session.contractId) {
        setOverview(null);
        setGovernance(null);
        setPendingCount(null);
        setNeedsSignatureCount(null);
        return;
      }

      setError(null);
      try {
        const [nextOverview, nextGovernance] = await Promise.all([
          fetchTokenOverview({
            sdk: session.sdk,
            contractId: session.contractId,
          }),
          fetchTokenOpsGovernance({
            sdk: session.sdk,
            contractId: session.contractId,
          }),
        ]);
        if (cancelled) return;
        setOverview(nextOverview);
        setGovernance(nextGovernance);

        const pendingByGroup = await Promise.all(
          nextGovernance.groups.map(async (group) => ({
            group,
            actions: await listPendingActions({
              sdk: session.sdk!,
              contractId: session.contractId!,
              groupPosition: group.groupPosition,
            }),
          })),
        );
        if (cancelled) return;

        const allPending = pendingByGroup.flatMap(({ actions }) => actions);
        setPendingCount(allPending.length);

        if (!session.identityId) {
          setNeedsSignatureCount(0);
          return;
        }

        const eligibleActions = pendingByGroup.flatMap(({ group, actions }) =>
          group.members.has(session.identityId!)
            ? actions
                .filter((action) =>
                  isCurrentlyActionable(
                    action,
                    group.groupPosition,
                    nextGovernance,
                  ),
                )
                .map((action) => ({ group, action }))
            : [],
        );
        const signerProgress = await Promise.all(
          eligibleActions.map(({ group, action }) =>
            listActionSigners({
              sdk: session.sdk!,
              contractId: session.contractId!,
              groupPosition: group.groupPosition,
              actionId: action.actionId,
              requiredPower: group.requiredPower,
            }),
          ),
        );
        if (!cancelled) {
          setNeedsSignatureCount(
            signerProgress.filter(
              (progress) => !progress.hasSigned(session.identityId!),
            ).length,
          );
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    }

    void refresh();
    return () => {
      cancelled = true;
    };
  }, [session.sdk, session.contractId, session.identityId]);

  useEffect(() => {
    const context = `${session.contractId ?? ""}:${session.identityId ?? ""}`;
    if (
      !identityInspectorOpen ||
      identityInspectorContext.current === context ||
      !governance ||
      !session.sdk ||
      !session.contractId
    ) {
      return;
    }

    let cancelled = false;
    const ids = [
      ...governance.groups.flatMap((group) => [...group.members.keys()]),
      ...(session.identityId ? [session.identityId] : []),
    ];
    identityInspectorContext.current = context;
    setIdentityInspectorLoading(true);
    setIdentityInspectorError(null);

    void fetchIdentityTokenStates({
      sdk: session.sdk,
      contractId: session.contractId,
      identityIds: ids,
    })
      .then((states) => {
        if (cancelled) return;
        setIdentityRows(
          new Map(
            [...states].map(([identityId, state]) => [
              identityId,
              { identityId, ...state },
            ]),
          ),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setIdentityInspectorError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIdentityInspectorLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    identityInspectorOpen,
    governance,
    session.contractId,
    session.identityId,
    session.sdk,
  ]);

  const memberships = useMemo(
    () =>
      governance?.groups.filter(
        (group) => session.identityId && group.members.has(session.identityId),
      ) ?? [],
    [governance, session.identityId],
  );
  const identityIds = useMemo(
    () => [...identityRows.keys(), session.identityId],
    [identityRows, session.identityId],
  );
  const dpnsNames = useDpnsNames(session.sdk, identityIds);

  async function inspectIdentity(identityId: string) {
    if (!session.sdk || !session.contractId || !identityId.trim()) return;
    setIdentityInspectorLoading(true);
    setIdentityInspectorError(null);
    try {
      const states = await fetchIdentityTokenStates({
        sdk: session.sdk,
        contractId: session.contractId,
        identityIds: [identityId],
      });
      setIdentityRows((previous) => {
        const next = new Map(previous);
        for (const [id, state] of states) {
          next.set(id, { identityId: id, ...state });
        }
        return next;
      });
      setIdentityLookupId("");
    } catch (err) {
      setIdentityInspectorError(errorMessage(err));
    } finally {
      setIdentityInspectorLoading(false);
    }
  }

  if (!session.contractId) {
    return (
      <div className="notice info">Configure a TokenOps contract first.</div>
    );
  }

  const maxSupply = overview?.supplyConfig.maxSupply ?? null;
  const hasPending = pendingCount != null && pendingCount > 0;
  const needsAttention =
    session.identityId &&
    needsSignatureCount != null &&
    needsSignatureCount > 0;

  return (
    <div className="overview-screen dashboard-screen">
      {error && <div className="notice error">{error}</div>}

      <header className="dashboard-header">
        <div>
          <span className="dashboard-eyebrow">Governance dashboard</span>
          <h2>
            {needsAttention
              ? "Your signature is needed"
              : "Governance at a glance"}
          </h2>
          <p>
            {needsAttention
              ? `${needsSignatureCount} active ${needsSignatureCount === 1 ? "proposal needs" : "proposals need"} your approval.`
              : "See who controls each operation and whether any proposals need attention."}
          </p>
        </div>
        {overview && (
          <span
            className={`token-status-pill ${overview.isPaused ? "paused" : "active"}`}
          >
            Token {overview.isPaused ? "paused" : "active"}
          </span>
        )}
      </header>

      <div className="dashboard-priority-grid">
        <button
          type="button"
          className={`dashboard-attention-card ${needsAttention ? "urgent" : ""}`}
          onClick={onNavigateToPending}
        >
          <span className="dashboard-card-label">Needs your signature</span>
          <strong>
            {session.identityId ? (needsSignatureCount ?? "…") : "—"}
          </strong>
          <span>
            {session.identityId
              ? needsAttention
                ? "Review and approve proposals"
                : "You are caught up"
              : "Sign in to see your approval queue"}
          </span>
        </button>

        <button
          type="button"
          className="dashboard-attention-card"
          onClick={onNavigateToPending}
        >
          <span className="dashboard-card-label">All active proposals</span>
          <strong>{pendingCount ?? "…"}</strong>
          <span>
            {hasPending
              ? "View signing progress"
              : "No actions awaiting approval"}
          </span>
        </button>

        <section className="dashboard-membership-card">
          <span className="dashboard-card-label">Your governance access</span>
          {!session.identityId ? (
            <>
              <strong>Signed out</strong>
              <span>Sign in to check group membership</span>
            </>
          ) : memberships.length === 0 ? (
            <>
              <strong>No operator groups</strong>
              <span>This identity cannot propose group-managed actions</span>
            </>
          ) : (
            <>
              <strong>
                {memberships.length}{" "}
                {memberships.length === 1 ? "group" : "groups"}
              </strong>
              <div className="dashboard-membership-list">
                {memberships.map((group) => {
                  const display = groupDisplay(
                    group.groupPosition,
                    governance?.rules ?? [],
                  );
                  return (
                    <span key={group.groupPosition}>
                      Group {group.groupPosition} ·{" "}
                      {display.domains
                        .map((domain) => domain.label)
                        .join(" + ") || "unused"}
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>

      <section className="overview-panel dashboard-control-panel">
        <div className="dashboard-section-heading">
          <div>
            <h3>Who controls what</h3>
            <p>See who can perform each operation.</p>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={onNavigateToGovernance}
          >
            Open governance
          </button>
        </div>
        <div className="dashboard-group-grid">
          {governance &&
            authorityCards(governance).map((card) => {
              return (
                <article
                  key={card.key}
                  className={`dashboard-group-card accent-${card.accent}`}
                >
                  <div className="dashboard-group-title">
                    <strong>{card.title}</strong>
                  </div>
                  <div className="dashboard-capabilities">
                    {card.capabilities.map((rule) => (
                      <span key={rule.key}>
                        {SHORT_CAPABILITY_LABEL[rule.key] ?? rule.label}
                      </span>
                    ))}
                  </div>
                  <span className="dashboard-group-meta">{card.meta}</span>
                </article>
              );
            })}
          {!governance && <span className="muted">Loading governance…</span>}
        </div>
      </section>

      <section className="overview-panel dashboard-token-card">
        <div className="dashboard-token-context">
          <div>
            <h3>{overview?.metadata.name || "Loading…"}</h3>
            {overview?.metadata.description && (
              <p>{overview.metadata.description}</p>
            )}
          </div>
          <div className="dashboard-token-facts">
            <span>
              <small>Supply</small>
              <strong>
                {overview ? formatAmount(overview.totalSupply) : "…"}
              </strong>
            </span>
            <span>
              <small>Maximum</small>
              <strong>
                {maxSupply && maxSupply > 0n
                  ? formatAmount(maxSupply)
                  : "Uncapped"}
              </strong>
            </span>
            <span>
              <small>Contract</small>
              <strong>
                <CopyableId id={session.contractId} explorer="dataContract" />
              </strong>
            </span>
            <span>
              <small>Token</small>
              <strong>
                {overview ? (
                  <CopyableId id={overview.tokenId} explorer="token" />
                ) : (
                  "…"
                )}
              </strong>
            </span>
          </div>
        </div>

        <details
          className="dashboard-identity-inspector"
          onToggle={(event) =>
            setIdentityInspectorOpen(event.currentTarget.open)
          }
        >
          <summary>
            <span>
              <strong>Check balances</strong>
              <small>View token balance and freeze status for identities</small>
            </span>
            <span className="dashboard-disclosure-label">
              {identityInspectorOpen ? "Close" : "Open"}
            </span>
          </summary>

          <div className="dashboard-identity-inspector-body">
            {identityInspectorError && (
              <div className="notice error">{identityInspectorError}</div>
            )}
            <form
              className="identity-lookup-form"
              onSubmit={(event) => {
                event.preventDefault();
                const identityId =
                  identityLookupId.trim() || session.identityId || "";
                void inspectIdentity(identityId);
              }}
            >
              <input
                value={identityLookupId}
                onChange={(event) => setIdentityLookupId(event.target.value)}
                placeholder="Identity ID - defaults to signed-in identity"
                aria-label="Identity ID"
              />
              <button
                type="submit"
                disabled={
                  identityInspectorLoading ||
                  (!identityLookupId.trim() && !session.identityId)
                }
              >
                Inspect
              </button>
            </form>

            {identityInspectorLoading && identityRows.size === 0 ? (
              <p className="muted">Loading identity balances…</p>
            ) : (
              <div className="table-wrap identity-table">
                <table>
                  <thead>
                    <tr>
                      <th>Identity</th>
                      <th>Balance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...identityRows.values()].map((row) => (
                      <tr key={row.identityId}>
                        <td>
                          <IdentityLabel
                            id={row.identityId}
                            dpnsNames={dpnsNames}
                            len={8}
                          />
                          {row.identityId === session.identityId && (
                            <span className="you-badge">You</span>
                          )}
                        </td>
                        <td>{formatAmount(row.balance)}</td>
                        <td>
                          <span
                            className={`badge ${row.isFrozen ? "frozen" : "ok"}`}
                          >
                            {row.isFrozen ? "Frozen" : "Active"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {identityRows.size === 0 && (
                      <tr>
                        <td colSpan={3} className="muted">
                          No group members or signed-in identity to inspect.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}
