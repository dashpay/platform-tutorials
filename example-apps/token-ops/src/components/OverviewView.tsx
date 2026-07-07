import { useEffect, useState } from "react";

import { CopyableId } from "./CopyableId";
import { errorMessage } from "../dash/logger";
import { fetchIdentityTokenState, fetchTokenOverview } from "../dash/token";
import { useSession } from "../session/useSession";

export function OverviewView() {
  const session = useSession();
  const [lookupId, setLookupId] = useState("");
  const [overview, setOverview] = useState<{
    tokenId: string;
    totalSupply: bigint;
    isPaused: boolean;
  } | null>(null);
  const [identityState, setIdentityState] = useState<{
    balance: bigint;
    isFrozen: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!session.sdk || !session.contractId) {
      setOverview(null);
      return;
    }
    setError(null);
    try {
      const nextOverview = await fetchTokenOverview({
        sdk: session.sdk,
        contractId: session.contractId,
      });
      setOverview(nextOverview);
      const identityId = lookupId.trim() || session.identityId;
      if (identityId) {
        setIdentityState(
          await fetchIdentityTokenState({
            sdk: session.sdk,
            contractId: session.contractId,
            identityId,
          }),
        );
      } else {
        setIdentityState(null);
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sdk, session.contractId, session.identityId]);

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
            void refresh();
          }}
        >
          <input
            value={lookupId}
            onChange={(event) => setLookupId(event.target.value)}
            placeholder={session.identityId ?? "Identity ID"}
          />
          <button type="submit">Inspect</button>
        </form>
        {identityState && (
          <div className="row" style={{ marginTop: "0.75rem" }}>
            <span className="badge">Balance {identityState.balance.toString()}</span>
            <span className={`badge ${identityState.isFrozen ? "frozen" : "ok"}`}>
              {identityState.isFrozen ? "Frozen" : "Not frozen"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
