import { useEffect, useState } from "react";

import { CopyableId } from "./CopyableId";
import { fetchContractOwnerId } from "../dash/contract";
import { errorMessage } from "../dash/logger";
import { fetchPanelMembers } from "../dash/panel";
import { updatePanelRoster } from "../dash/updatePanelRoster";
import { useSession } from "../session/useSession";

/**
 * Panel roster changes are owner-key-authorized, not group-gated —
 * `DataContractConfig` has no ChangeControlRules-style admin gate of its
 * own, so `sdk.contracts.update(...)` is unconditionally signed by the
 * contract owner. The bounty program *operator* administers who's on the
 * panel; the panel doesn't self-govern its own membership. This view is
 * gated on "connected identity is the contract owner" to teach that
 * mechanism correctly rather than implying it's panel-gated.
 */
export function RosterView() {
  const session = useSession();
  const [members, setMembers] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [addId, setAddId] = useState("");
  const [removeId, setRemoveId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!session.sdk || !session.contractId) return;
    setError(null);
    try {
      const [memberIds, owner] = await Promise.all([
        fetchPanelMembers({ sdk: session.sdk, contractId: session.contractId }),
        fetchContractOwnerId({
          sdk: session.sdk,
          contractId: session.contractId,
        }),
      ]);
      setMembers(memberIds);
      setOwnerId(owner);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sdk, session.contractId]);

  const isOwner = Boolean(ownerId && session.identityId === ownerId);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!session.sdk || !session.keyManager || !session.contractId) return;
    setBusy(true);
    setError(null);
    try {
      await updatePanelRoster({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: session.contractId,
        addMemberId: addId.trim() || undefined,
        removeMemberId: removeId.trim() || undefined,
        log: session.log,
      });
      setAddId("");
      setRemoveId("");
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!session.contractId) {
    return (
      <div className="notice info">Configure a bounty contract first.</div>
    );
  }

  return (
    <div>
      {error && <div className="notice error">{error}</div>}
      <div className="card">
        <h3>Current panel members</h3>
        <ul>
          {members.map((id) => (
            <li key={id}>
              <CopyableId id={id} />
            </li>
          ))}
        </ul>
      </div>

      {isOwner ? (
        <div className="card">
          <h3>Rotate a member</h3>
          <p className="muted">
            The panel must always have exactly 3 members — provide both an
            addition and a removal to swap one out, or just one if the roster is
            mid-adjustment.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="remove-id">Remove member ID</label>
                <input
                  id="remove-id"
                  value={removeId}
                  onChange={(event) => setRemoveId(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="add-id">Add member ID</label>
                <input
                  id="add-id"
                  value={addId}
                  onChange={(event) => setAddId(event.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy || (!addId.trim() && !removeId.trim())}
            >
              Update roster
            </button>
          </form>
        </div>
      ) : (
        <div className="notice info row">
          Only the contract owner (<CopyableId id={ownerId} />) can change the
          panel roster — sign in as that identity to make changes here.
        </div>
      )}
    </div>
  );
}
