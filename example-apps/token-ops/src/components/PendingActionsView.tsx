import { useEffect, useState } from "react";

import { CopyableId } from "./CopyableId";
import { errorMessage } from "../dash/logger";
import {
  fetchTokenOpsGovernance,
  type TokenOpsGroupInfo,
} from "../dash/governance";
import {
  describeGroupAction,
  listActionSigners,
  listPendingActions,
  type ActionSignerProgress,
  type PendingAction,
  type PendingTokenActionParams,
} from "../dash/groupActions";
import {
  burnToken,
  destroyFrozenToken,
  emergencyTokenAction,
  freezeToken,
  mintToken,
  unfreezeToken,
} from "../dash/tokenOperations";
import { useSession } from "../session/useSession";

type PendingWithGroup = PendingAction & { group: TokenOpsGroupInfo };

/**
 * Surfaces which identity a proposal operates on. The action data already
 * carries this (parsed into `action.params`) but the card previously only
 * showed the proposer, so a co-signer couldn't tell who a freeze/burn/mint
 * targeted before signing. Amounts are raw token base units (no decimal
 * conversion happens anywhere in this view).
 */
function ActionDetail({ params }: { params: PendingTokenActionParams }) {
  switch (params.kind) {
    case "mint":
      return (
        <>
          <p>
            Recipient: <CopyableId id={params.recipientId} len={8} />
          </p>
          <p>Amount: {params.amount.toString()}</p>
        </>
      );
    case "burn":
      return (
        <>
          <p>
            Burn from: <CopyableId id={params.burnFromId} len={8} />
          </p>
          <p>Amount: {params.amount.toString()}</p>
        </>
      );
    case "freeze":
    case "unfreeze":
      return (
        <p>
          Target: <CopyableId id={params.targetIdentityId} len={8} />
        </p>
      );
    case "destroyFrozen":
      return (
        <>
          <p>
            Target: <CopyableId id={params.targetIdentityId} len={8} />
          </p>
          {params.amount != null && <p>Amount: {params.amount.toString()}</p>}
        </>
      );
    case "emergency":
      return (
        <p className="muted">
          Token-wide {params.action} — no per-identity target.
        </p>
      );
    default:
      return null;
  }
}

export function PendingActionsView() {
  const session = useSession();
  const [actions, setActions] = useState<PendingWithGroup[]>([]);
  const [progress, setProgress] = useState<Map<string, ActionSignerProgress>>(
    new Map(),
  );
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!session.sdk || !session.contractId) return;
    setError(null);
    try {
      const governance = await fetchTokenOpsGovernance({
        sdk: session.sdk,
        contractId: session.contractId,
      });
      const nextActions: PendingWithGroup[] = [];
      const nextProgress = new Map<string, ActionSignerProgress>();
      await Promise.all(
        governance.groups.map(async (group) => {
          const pending = await listPendingActions({
            sdk: session.sdk!,
            contractId: session.contractId!,
            groupPosition: group.groupPosition,
          });
          nextActions.push(...pending.map((action) => ({ ...action, group })));
          await Promise.all(
            pending.map(async (action) => {
              nextProgress.set(
                action.actionId,
                await listActionSigners({
                  sdk: session.sdk!,
                  contractId: session.contractId!,
                  groupPosition: group.groupPosition,
                  actionId: action.actionId,
                  requiredPower: group.requiredPower,
                }),
              );
            }),
          );
        }),
      );
      setActions(nextActions);
      setProgress(nextProgress);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sdk, session.contractId]);

  async function coSign(action: PendingWithGroup) {
    if (!session.sdk || !session.keyManager || !session.contractId || !action.params) {
      return;
    }
    const common = {
      sdk: session.sdk,
      keyManager: session.keyManager,
      contractId: session.contractId,
      groupPosition: action.group.groupPosition,
      actionId: action.actionId,
      log: session.log,
    };
    setBusyActionId(action.actionId);
    setError(null);
    try {
      if (action.params.kind === "mint") {
        await mintToken({
          ...common,
          amount: action.params.amount,
          recipientId: action.params.recipientId,
          publicNote: action.params.publicNote,
        });
      } else if (action.params.kind === "burn") {
        await burnToken({
          ...common,
          amount: action.params.amount,
          publicNote: action.params.publicNote,
        });
      } else if (action.params.kind === "freeze") {
        await freezeToken({
          ...common,
          targetIdentityId: action.params.targetIdentityId,
          publicNote: action.params.publicNote,
        });
      } else if (action.params.kind === "unfreeze") {
        await unfreezeToken({
          ...common,
          targetIdentityId: action.params.targetIdentityId,
          publicNote: action.params.publicNote,
        });
      } else if (action.params.kind === "destroyFrozen") {
        await destroyFrozenToken({
          ...common,
          targetIdentityId: action.params.targetIdentityId,
          publicNote: action.params.publicNote,
        });
      } else {
        await emergencyTokenAction({
          ...common,
          action: action.params.action,
          publicNote: action.params.publicNote,
        });
      }
      session.log(`Co-signed action ${action.actionId}.`, "success");
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyActionId(null);
    }
  }

  function canCurrentIdentitySign(
    action: PendingWithGroup,
    signerProgress: ActionSignerProgress | undefined,
  ): boolean {
    if (session.status !== "authenticated" || !session.identityId) return false;
    if (!action.params || !signerProgress) return false;
    if (!action.group.members.has(session.identityId)) return false;
    return !signerProgress.hasSigned(session.identityId);
  }

  return (
    <div>
      {error && <div className="notice error">{error}</div>}
      <div className="card">
        <div className="row between">
          <h3>Pending group actions</h3>
          <button type="button" className="secondary" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
        <p className="muted">
          Eligible unsigned group members can co-sign supported token proposals
          directly from this list.
        </p>
      </div>
      <div className="list">
        {actions.map((action) => {
          const p = progress.get(action.actionId);
          const canSign = canCurrentIdentitySign(action, p);
          return (
            <div key={action.actionId} className="card">
              <div className="row between">
                <strong>{describeGroupAction(action.eventName)}</strong>
                <span className="badge">Group {action.group.groupPosition}</span>
              </div>
              <p>
                Action: <CopyableId id={action.actionId} len={8} />
              </p>
              <p>
                Proposer: <CopyableId id={action.proposerId} len={8} />
              </p>
              {action.params && <ActionDetail params={action.params} />}
              <p className="muted">
                {p
                  ? `${p.signedPower.toString()}/${p.requiredPower} power signed`
                  : "Signer progress loading"}
              </p>
              {!action.params && (
                <p className="muted">
                  This proposal type is display-only in TokenOps v1.
                </p>
              )}
              {session.identityId && p?.hasSigned(session.identityId) && (
                <p className="muted">This identity already signed.</p>
              )}
              {canSign && (
                <button
                  type="button"
                  disabled={busyActionId === action.actionId}
                  onClick={() => void coSign(action)}
                >
                  {busyActionId === action.actionId ? "Co-signing..." : "Co-sign"}
                </button>
              )}
            </div>
          );
        })}
        {actions.length === 0 && <p className="muted">No pending actions.</p>}
      </div>
    </div>
  );
}
