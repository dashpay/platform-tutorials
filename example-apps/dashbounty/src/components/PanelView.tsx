import { useEffect, useState } from "react";

import { CopyableId } from "./CopyableId";
import { destroyFrozenCredit } from "../dash/destroyFrozenCredit";
import {
  describeGroupAction,
  listActionSigners,
  listPendingActions,
  type ActionSignerProgress,
  type PendingAction,
} from "../dash/groupActions";
import { freezeCredit } from "../dash/freezeCredit";
import { errorMessage } from "../dash/logger";
import { fetchPanelInfo, isPanelMember, type PanelInfo } from "../dash/panel";
import { unfreezeCredit } from "../dash/unfreezeCredit";
import { useSession } from "../session/useSession";

type ProposeKind = "freeze" | "unfreeze" | "destroy";

function actionKindFromName(eventName: string): ProposeKind | null {
  const lower = eventName.toLowerCase();
  if (lower.includes("unfreeze")) return "unfreeze";
  if (lower.includes("freeze")) return "freeze";
  if (lower.includes("destroy")) return "destroy";
  return null;
}

async function runAction(
  kind: ProposeKind,
  args: {
    sdk: NonNullable<ReturnType<typeof useSession>["sdk"]>;
    keyManager: NonNullable<ReturnType<typeof useSession>["keyManager"]>;
    contractId: string;
    groupPosition: number;
    frozenIdentityId: string;
    actionId?: string;
    log: ReturnType<typeof useSession>["log"];
  },
) {
  if (kind === "freeze") return freezeCredit(args);
  if (kind === "unfreeze") return unfreezeCredit(args);
  return destroyFrozenCredit(args);
}

export function PanelView() {
  const session = useSession();
  const [panel, setPanel] = useState<PanelInfo | null>(null);
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [signerProgress, setSignerProgress] = useState<
    Map<string, ActionSignerProgress>
  >(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Propose form
  const [proposeKind, setProposeKind] = useState<ProposeKind>("freeze");
  const [targetIdentityId, setTargetIdentityId] = useState("");
  const [note, setNote] = useState("");

  // Co-sign target confirmation, keyed by actionId. `event.toJSON().data`'s
  // shape isn't documented in the SDK bindings (typed `unknown`) — rather
  // than guess at an unverified payload, panel members confirm the target
  // identity themselves (which they'd know from out-of-band coordination
  // with the proposer) when co-signing.
  const [cosignTargets, setCosignTargets] = useState<Record<string, string>>(
    {},
  );

  async function refresh() {
    if (!session.sdk || !session.contractId) return;
    setError(null);
    try {
      // fetchPanelInfo resolves the token's CURRENT main control group
      // position (dynamic after a roster rotation) — every group query and
      // action below must target that same position.
      const info = await fetchPanelInfo({
        sdk: session.sdk,
        contractId: session.contractId,
      });
      setPanel(info);
      const actions = await listPendingActions({
        sdk: session.sdk,
        contractId: session.contractId,
        groupPosition: info.groupPosition,
      });
      setPending(actions);
      const progress = new Map<string, ActionSignerProgress>();
      await Promise.all(
        actions.map(async (action) => {
          const p = await listActionSigners({
            sdk: session.sdk!,
            contractId: session.contractId!,
            groupPosition: info.groupPosition,
            actionId: action.actionId,
            requiredPower: info.requiredPower,
          });
          progress.set(action.actionId, p);
        }),
      );
      setSignerProgress(progress);
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

  const member =
    panel && session.identityId
      ? isPanelMember(panel, session.identityId)
      : false;

  async function handlePropose(event: React.FormEvent) {
    event.preventDefault();
    if (!session.sdk || !session.keyManager || !session.contractId || !panel)
      return;
    setBusy(true);
    setError(null);
    try {
      await runAction(proposeKind, {
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: session.contractId,
        groupPosition: panel.groupPosition,
        frozenIdentityId: targetIdentityId.trim(),
        log: session.log,
      });
      setTargetIdentityId("");
      setNote("");
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCosign(action: PendingAction) {
    if (!session.sdk || !session.keyManager || !session.contractId || !panel)
      return;
    const kind = actionKindFromName(action.eventName);
    if (!kind) {
      setError(`Unrecognized action type: ${action.eventName}`);
      return;
    }
    const frozenIdentityId = (cosignTargets[action.actionId] ?? "").trim();
    if (!frozenIdentityId) {
      setError("Confirm the target identity ID before co-signing.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await runAction(kind, {
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: session.contractId,
        groupPosition: panel.groupPosition,
        frozenIdentityId,
        actionId: action.actionId,
        log: session.log,
      });
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
        <h3>Triage Panel</h3>
        {panel ? (
          <>
            <p className="muted">
              {panel.members.size} member(s), requires {panel.requiredPower} of
              them to act. Active group position: {panel.groupPosition}.
            </p>
            <ul>
              {[...panel.members.keys()].map((id) => (
                <li key={id}>
                  <CopyableId id={id} />
                  {id === session.identityId && " (you)"}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">Loading…</p>
        )}
        {!member && session.status === "authenticated" && (
          <p className="notice info">
            You are signed in but are not a member of this Triage Panel.
          </p>
        )}
      </div>

      {member && (
        <div className="card">
          <h3>Propose an action</h3>
          <form onSubmit={handlePropose}>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="propose-kind">Action</label>
                <select
                  id="propose-kind"
                  value={proposeKind}
                  onChange={(event) =>
                    setProposeKind(event.target.value as ProposeKind)
                  }
                >
                  <option value="freeze">Freeze</option>
                  <option value="unfreeze">Unfreeze</option>
                  <option value="destroy">Slash (destroy frozen)</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="target">Target identity ID</label>
                <input
                  id="target"
                  value={targetIdentityId}
                  onChange={(event) => setTargetIdentityId(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="note">Public note (optional)</label>
              <input
                id="note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <button type="submit" disabled={busy}>
              Propose
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h3>Pending actions</h3>
        <div className="list">
          {pending.map((action) => {
            const progress = signerProgress.get(action.actionId);
            const alreadySigned = session.identityId
              ? (progress?.hasSigned(session.identityId) ?? false)
              : false;
            const pct = progress
              ? Math.min(
                  100,
                  (Number(progress.signedPower) / progress.requiredPower) * 100,
                )
              : 0;
            return (
              <div key={action.actionId} className="card">
                <div className="row between">
                  <strong>{describeGroupAction(action.eventName)}</strong>
                  <span className="muted row">
                    proposed by <CopyableId id={action.proposerId} len={6} />
                  </span>
                </div>
                {progress && (
                  <>
                    <div className="progress">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <p className="muted">
                      {progress.signedPower.toString()}/{progress.requiredPower}{" "}
                      power signed
                    </p>
                  </>
                )}
                {member && !alreadySigned && (
                  <div className="row">
                    <input
                      placeholder="Confirm target identity ID"
                      value={cosignTargets[action.actionId] ?? ""}
                      onChange={(event) =>
                        setCosignTargets((prev) => ({
                          ...prev,
                          [action.actionId]: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleCosign(action)}
                    >
                      Sign
                    </button>
                  </div>
                )}
                {alreadySigned && (
                  <p className="muted">You already signed this.</p>
                )}
              </div>
            );
          })}
          {pending.length === 0 && <p className="muted">No pending actions.</p>}
        </div>
      </div>
    </div>
  );
}
