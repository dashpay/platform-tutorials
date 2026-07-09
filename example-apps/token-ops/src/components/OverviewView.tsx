import { useEffect, useState } from "react";

import { CopyableId } from "./CopyableId";
import { TOKEN_MAX_SUPPLY } from "../dash/contract";
import { fetchTokenOpsGovernance } from "../dash/governance";
import { listPendingActions } from "../dash/groupActions";
import { errorMessage } from "../dash/logger";
import { fetchIdentityTokenStates, fetchTokenOverview } from "../dash/token";
import { useSession } from "../session/useSession";

type IdentityTokenState = {
  identityId: string;
  balance: bigint;
  isFrozen: boolean;
};

function formatAmount(value: bigint): string {
  return value.toLocaleString("en-US");
}

function supplyPercent(totalSupply: bigint): number {
  const basisPoints = (totalSupply * 10_000n) / TOKEN_MAX_SUPPLY;
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
  } | null>(null);
  const [identityRows, setIdentityRows] = useState<Map<string, IdentityTokenState>>(
    new Map(),
  );
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

  if (!session.contractId) {
    return <div className="notice info">Configure a TokenOps contract first.</div>;
  }

  const totalSupply = overview?.totalSupply ?? 0n;
  const percentMinted = supplyPercent(totalSupply);
  const headroom = TOKEN_MAX_SUPPLY - totalSupply;

  return (
    <div className="overview-screen">
      {error && <div className="notice error">{error}</div>}
      <div className="overview-grid">
        <section className="overview-panel token-supply-panel">
          <div className="row between">
            <h3>Token supply</h3>
            <span
              className={`token-status-pill ${overview?.isPaused ? "paused" : "active"}`}
            >
              {overview?.isPaused ? "Paused" : "Active"}
            </span>
          </div>
          <div className="supply-meter-head">
            <strong>{formatAmount(totalSupply)}</strong>
            <span>of {formatAmount(TOKEN_MAX_SUPPLY)} max</span>
          </div>
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
            <span>{formatAmount(headroom > 0n ? headroom : 0n)} remaining</span>
          </div>
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
                    <CopyableId id={row.identityId} len={8} />
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
