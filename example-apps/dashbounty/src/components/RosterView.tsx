import { useEffect, useState } from "react";

import { CopyableId } from "./CopyableId";
import { fetchContractOwnerId } from "../dash/contract";
import { errorMessage } from "../dash/logger";
import { fetchActivePanelPosition, fetchPanelMembers } from "../dash/panel";
import { rotatePanelRoster } from "../dash/rotatePanelRoster";
import { useSession } from "../session/useSession";

/**
 * Triage Panel roster: current members, plus owner-gated rotation.
 *
 * A published group itself is IMMUTABLE — Platform rejects any contract
 * update that touches an existing group
 * (DataContractUpdateActionNotAllowedError), so there is no in-place
 * add/remove/swap-member edit. Rotation instead appends a brand-new
 * 3-member group at the next contiguous position and repoints the token's
 * mainControlGroup at it (see rotatePanelRoster.ts). Because
 * freeze/unfreeze/destroy are gated on AuthorizedActionTakers.MainGroup(),
 * the new roster takes over token governance the moment the repoint lands.
 *
 * Only the CONTRACT OWNER can rotate — mainControlGroupCanBeModified is
 * ContractOwner, matching this app's admin model where the bounty operator
 * administers roster membership. The form only renders for the signed-in
 * owner; anyone else sees the read-only member list.
 */
export function RosterView() {
  const session = useSession();
  const [members, setMembers] = useState<string[]>([]);
  const [groupPosition, setGroupPosition] = useState<number | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Rotation form: exactly 3 replacement member IDs.
  const [newMemberIds, setNewMemberIds] = useState<[string, string, string]>([
    "",
    "",
    "",
  ]);

  async function refresh() {
    if (!session.sdk || !session.contractId) return;
    setError(null);
    try {
      const position = await fetchActivePanelPosition({
        sdk: session.sdk,
        contractId: session.contractId,
      });
      const [memberIds, owner] = await Promise.all([
        fetchPanelMembers({
          sdk: session.sdk,
          contractId: session.contractId,
          groupPosition: position,
        }),
        fetchContractOwnerId({
          sdk: session.sdk,
          contractId: session.contractId,
        }),
      ]);
      setGroupPosition(position);
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

  const isOwner =
    session.status === "authenticated" &&
    !!session.identityId &&
    session.identityId === ownerId;

  async function handleRotate(event: React.FormEvent) {
    event.preventDefault();
    if (!session.sdk || !session.keyManager || !session.contractId) return;
    setBusy(true);
    setError(null);
    try {
      await rotatePanelRoster({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: session.contractId,
        newPanelMemberIds: newMemberIds.map((id) => id.trim()),
        log: session.log,
      });
      setNewMemberIds(["", "", ""]);
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
        {groupPosition !== null && (
          <p className="muted">Active group position: {groupPosition}</p>
        )}
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

      {isOwner && (
        <div className="card">
          <h3>Rotate panel</h3>
          <p className="muted">
            Enter exactly 3 identity IDs for the replacement roster. This
            appends a new group and repoints token governance at it in one flow
            — the current group stays in the contract but loses all power.
          </p>
          <form onSubmit={handleRotate}>
            {newMemberIds.map((value, index) => (
              <div className="field" key={index}>
                <label htmlFor={`new-member-${index + 1}`}>
                  New member {index + 1}
                </label>
                <input
                  id={`new-member-${index + 1}`}
                  value={value}
                  required
                  onChange={(event) =>
                    setNewMemberIds((prev) => {
                      const next = [...prev] as typeof prev;
                      next[index] = event.target.value;
                      return next;
                    })
                  }
                />
              </div>
            ))}
            <button type="submit" disabled={busy}>
              Rotate panel
            </button>
          </form>
        </div>
      )}

      <div className="notice info">
        A published group is immutable — members can never be added, removed, or
        swapped in place. Rotation works by appending a new 3-member group and
        repointing the token&apos;s main control group at it; only the contract
        owner can do this.
      </div>
    </div>
  );
}
