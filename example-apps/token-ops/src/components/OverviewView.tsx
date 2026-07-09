import { useEffect, useMemo, useState } from "react";

import { CopyableId } from "./CopyableId";
import { IdentityLabel } from "./IdentityLabel";
import { fetchTokenOpsGovernance } from "../dash/governance";
import { listPendingActions } from "../dash/groupActions";
import { errorMessage } from "../dash/logger";
import {
  fetchIdentityTokenStates,
  fetchTokenOverview,
  type TokenSupplyConfig,
} from "../dash/token";
import { useDpnsNames } from "../hooks/useDpnsNames";
import { useSession } from "../session/useSession";

type IdentityTokenState = {
  identityId: string;
  balance: bigint;
  isFrozen: boolean;
};

function formatAmount(value: bigint): string {
  return value.toLocaleString("en-US");
}

function supplyPercent(totalSupply: bigint, maxSupply: bigint): number {
  if (maxSupply <= 0n) return 0;
  const basisPoints = (totalSupply * 10_000n) / maxSupply;
  return Math.max(0, Math.min(100, Number(basisPoints) / 100));
}

export function OverviewView({
  watchedIdentityIds,
  onWatchIdentity,
  onNavigateToPending,
}: {
  watchedIdentityIds: string[];
  onWatchIdentity: (identityId: string) => void;
  onNavigateToPending: () => void;
}) {
  const session = useSession();
  const [lookupId, setLookupId] = useState("");
  const [overview, setOverview] = useState<{
    tokenId: string;
    totalSupply: bigint;
    isPaused: boolean;
    metadata: { name: string; description: string };
    supplyConfig: TokenSupplyConfig;
  } | null>(null);
  const [identityRows, setIdentityRows] = useState<
    Map<string, IdentityTokenState>
  >(new Map());
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(extraIdentityId?: string) {
    if (!session.sdk || !session.contractId) {
      setOverview(null);
      setIdentityRows(new Map());
      setPendingCount(null);
      return;
    }
    setError(null);
    try {
      const [nextOverview, governance] = await Promise.all([
        fetchTokenOverview({
          sdk: session.sdk,
          contractId: session.contractId,
        }),
        fetchTokenOpsGovernance({
          sdk: session.sdk,
          contractId: session.contractId,
        }),
      ]);
      setOverview(nextOverview);
      const groupIdentityIds = governance.groups.flatMap((group) => [
        ...group.members.keys(),
      ]);
      const signedInId = session.identityId ?? undefined;
      const ids = [
        ...groupIdentityIds,
        ...watchedIdentityIds,
        ...(signedInId ? [signedInId] : []),
        ...(extraIdentityId?.trim() ? [extraIdentityId.trim()] : []),
      ];
      const states = await fetchIdentityTokenStates({
        sdk: session.sdk,
        contractId: session.contractId,
        identityIds: ids,
      });
      setIdentityRows(() => {
        const next = new Map<string, IdentityTokenState>();
        for (const [identityId, state] of states) {
          next.set(identityId, { identityId, ...state });
        }
        return next;
      });

      // Count every ACTIVE group action across all groups — the same total
      // the Pending Actions tab lists. Group actions are per-group, so fan
      // out across governance.groups and sum the lengths.
      const pendingPerGroup = await Promise.all(
        governance.groups.map((group) =>
          listPendingActions({
            sdk: session.sdk!,
            contractId: session.contractId!,
            groupPosition: group.groupPosition,
          }),
        ),
      );
      setPendingCount(
        pendingPerGroup.reduce((total, actions) => total + actions.length, 0),
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sdk, session.contractId, session.identityId, watchedIdentityIds]);

  const identityIds = useMemo(
    () => [...identityRows.keys(), session.identityId],
    [identityRows, session.identityId],
  );
  const dpnsNames = useDpnsNames(session.sdk, identityIds);

  if (!session.contractId) {
    return (
      <div className="notice info">Configure a TokenOps contract first.</div>
    );
  }

  const totalSupply = overview?.totalSupply ?? 0n;
  const baseSupply = overview?.supplyConfig.baseSupply ?? 0n;
  const maxSupply = overview?.supplyConfig.maxSupply ?? null;
  const hasCap = maxSupply != null && maxSupply > 0n;
  const percentMinted = hasCap ? supplyPercent(totalSupply, maxSupply) : 0;
  const headroom = hasCap ? maxSupply - totalSupply : 0n;
  const isPerpetual = overview?.supplyConfig.hasPerpetualDistribution ?? false;
  const isPreProgrammed =
    overview?.supplyConfig.hasPreProgrammedDistribution ?? false;
  const distributionNote = isPerpetual
    ? isPreProgrammed
      ? " — supply grows via perpetual and pre-programmed distribution."
      : " — supply grows via perpetual distribution."
    : isPreProgrammed
      ? " — supply grows via pre-programmed distribution."
      : ".";

  return (
    <div className="overview-screen">
      {error && <div className="notice error">{error}</div>}
      {overview && (
        <header className="token-header">
          <div className="token-header-title">
            <h2>{overview.metadata.name || "Token"}</h2>
            <span
              className={`token-status-pill ${overview.isPaused ? "paused" : "active"}`}
            >
              {overview.isPaused ? "Paused" : "Active"}
            </span>
          </div>
          {overview.metadata.description && (
            <p>{overview.metadata.description}</p>
          )}
        </header>
      )}
      <div className="overview-grid">
        <section className="overview-panel token-supply-panel">
          <h3>Token supply</h3>
          <div className="supply-meter-head">
            <strong>{formatAmount(totalSupply)}</strong>
            <span>
              {hasCap ? (
                <>of {formatAmount(maxSupply)} max</>
              ) : (
                "circulating"
              )}
            </span>
          </div>
          {hasCap ? (
            <>
              <div
                className="supply-meter"
                role="progressbar"
                aria-label="Minted supply"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentMinted}
              >
                <span style={{ width: `${percentMinted}%` }} />
              </div>
              <div className="row between supply-meter-foot">
                <span>{percentMinted.toFixed(2)}% minted</span>
                <span>
                  {formatAmount(headroom > 0n ? headroom : 0n)} remaining
                </span>
              </div>
            </>
          ) : (
            <>
              {baseSupply > 0n && (
                <div className="supply-meter-foot">
                  <span>{formatAmount(baseSupply)} base supply</span>
                </div>
              )}
              <div className="supply-meter-foot">
                <span>No fixed maximum supply{distributionNote}</span>
              </div>
            </>
          )}
          {hasCap && baseSupply > 0n && (
            <div className="supply-meter-foot">
              <span>{formatAmount(baseSupply)} base supply</span>
            </div>
          )}
        </section>

        <section className="overview-panel token-details-panel">
          <h3>Token details</h3>
          <div className="id-row">
            <span>Contract ID</span>
            <strong>
              <CopyableId id={session.contractId} explorer="dataContract" />
            </strong>
          </div>
          <div className="id-row">
            <span>Token ID</span>
            <strong>
              {overview ? (
                <CopyableId id={overview.tokenId} explorer="token" />
              ) : (
                "Loading..."
              )}
            </strong>
          </div>
          <button
            type="button"
            className="id-row id-row-button"
            onClick={onNavigateToPending}
            title="View pending operations"
          >
            <span>Pending operations</span>
            <strong>
              {pendingCount === null ? (
                <span className="pending-count none">…</span>
              ) : (
                <span
                  className={`pending-count ${pendingCount > 0 ? "active" : "none"}`}
                >
                  {pendingCount}
                </span>
              )}
            </strong>
          </button>
        </section>
      </div>

      <section className="overview-panel identity-inspector">
        <h3>Inspect an identity</h3>
        <form
          className="identity-lookup-form"
          onSubmit={(event) => {
            event.preventDefault();
            const identityId = lookupId.trim() || session.identityId;
            if (!identityId) return;
            onWatchIdentity(identityId);
            void refresh(identityId);
          }}
        >
          <input
            value={lookupId}
            onChange={(event) => setLookupId(event.target.value)}
            placeholder="Identity ID - defaults to signed-in identity"
          />
          <button type="submit">Inspect</button>
        </form>
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
                  <td>{row.balance.toString()}</td>
                  <td>
                    <span className={`badge ${row.isFrozen ? "frozen" : "ok"}`}>
                      {row.isFrozen ? "Frozen" : "Active"}
                    </span>
                  </td>
                </tr>
              ))}
              {identityRows.size === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    No identities loaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
