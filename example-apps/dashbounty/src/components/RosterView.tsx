import { useEffect, useState } from "react";

import { CopyableId } from "./CopyableId";
import { fetchContractOwnerId } from "../dash/contract";
import { errorMessage } from "../dash/logger";
import { fetchPanelMembers } from "../dash/panel";
import { useSession } from "../session/useSession";

/**
 * Read-only view of the Triage Panel roster.
 *
 * The roster is FIXED once the contract is registered. Platform's contract
 * update validation rejects any change to an existing group with
 * DataContractUpdateActionNotAllowedError ("change group at position 0 is
 * not allowed") — there is no live "rotate a member" operation, owner-signed
 * or otherwise. On top of that, this token config locks
 * mainControlGroupCanBeModified to NoOne, so the token can never be
 * repointed at a different group either. Choose panelists carefully at
 * registration time; a different roster means registering (or selecting) a
 * new contract with the desired members — see the Account tab.
 */
export function RosterView() {
  const session = useSession();
  const [members, setMembers] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!session.sdk || !session.contractId) return;
      setError(null);
      try {
        const [memberIds, owner] = await Promise.all([
          fetchPanelMembers({
            sdk: session.sdk,
            contractId: session.contractId,
          }),
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
    })();
  }, [session.sdk, session.contractId]);

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
        {ownerId && (
          <p className="muted row">
            Contract owner: <CopyableId id={ownerId} />
          </p>
        )}
      </div>

      <div className="notice info">
        The panel roster is fixed at contract registration — Platform rejects
        any contract update that changes an existing group, so members cannot
        be added, removed, or swapped on a live contract. To run a different
        panel, register a new contract with the desired members from the
        Account tab.
      </div>
    </div>
  );
}
