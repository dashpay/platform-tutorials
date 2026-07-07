import { useEffect, useState } from "react";

import { CopyableId } from "./CopyableId";
import { fetchTokenOpsGovernance } from "../dash/governance";
import { errorMessage } from "../dash/logger";
import { fetchIdentityTokenStates, fetchTokenOverview } from "../dash/token";
import { useSession } from "../session/useSession";

type IdentityTokenState = {
  identityId: string;
  balance: bigint;
  isFrozen: boolean;
};

export function OverviewView({
  watchedIdentityIds,
  onWatchIdentity,
}: {
  watchedIdentityIds: string[];
  onWatchIdentity: (identityId: string) => void;
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
  const [error, setError] = useState<string | null>(null);

  async function refresh(extraIdentityId?: string) {
    if (!session.sdk || !session.contractId) {
      setOverview(null);
      setIdentityRows(new Map());
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

  return (
    <div>
      {error && <div className="notice error">{error}</div>}
      <div className="card">
        <h3>Token overview</h3>
        <p className="muted">
          One contract, one token, three governance groups, and explicit
          ChangeControlRules for every relevant token capability.
        </p>
        <div className="stats-grid">
          <div>
            <span className="muted">Contract</span>
            <strong>
              <CopyableId id={session.contractId} />
            </strong>
          </div>
          <div>
            <span className="muted">Token ID</span>
            <strong>
              {overview ? <CopyableId id={overview.tokenId} /> : "Loading..."}
            </strong>
          </div>
          <div>
            <span className="muted">Total supply</span>
            <strong>{overview?.totalSupply.toString() ?? "..."}</strong>
          </div>
          <div>
            <span className="muted">Status</span>
            <strong>{overview?.isPaused ? "Paused" : "Active"}</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Identity lookup</h3>
        <form
          className="row"
          onSubmit={(event) => {
            event.preventDefault();
            const identityId = lookupId.trim();
            if (!identityId) return;
            onWatchIdentity(identityId);
            void refresh(identityId);
          }}
        >
          <input
            value={lookupId}
            onChange={(event) => setLookupId(event.target.value)}
            placeholder={session.identityId ?? "Identity ID"}
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
      </div>
    </div>
  );
}
