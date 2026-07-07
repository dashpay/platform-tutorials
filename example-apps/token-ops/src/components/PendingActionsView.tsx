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
function actionDetails(
  params: PendingTokenActionParams,
): { label: string; value: React.ReactNode; prominent?: boolean }[] {
  switch (params.kind) {
    case "mint":
      return [
        {
          label: "Recipient",
          value: <CopyableId id={params.recipientId} len={8} />,
          prominent: true,
        },
        { label: "Amount", value: params.amount.toString(), prominent: true },
      ];
    case "burn":
      return [
        {
          label: "Burn from",
          value: <CopyableId id={params.burnFromId} len={8} />,
          prominent: true,
        },
        { label: "Amount", value: params.amount.toString(), prominent: true },
      ];
    case "freeze":
    case "unfreeze":
      return [
        {
          label: "Target",
          value: <CopyableId id={params.targetIdentityId} len={8} />,
          prominent: true,
        },
      ];
    case "destroyFrozen":
      return [
        {
          label: "Target",
          value: <CopyableId id={params.targetIdentityId} len={8} />,
          prominent: true,
        },
        ...(params.amount != null
          ? [{ label: "Amount", value: params.amount.toString(), prominent: true }]
          : []),
      ];
    case "emergency":
      return [
        {
          label: "Scope",
          value: `Applies to the entire token: ${params.action}`,
          prominent: true,
        },
      ];
    default:
      return [];
  }
}

function actionKind(action: PendingWithGroup): string {
  if (action.params) return action.params.kind;
  return describeGroupAction(action.eventName).toLowerCase().split(" ")[0] ?? "other";
}

function actionIcon(kind: string): string {
  if (kind === "mint") return "+";
  if (kind === "burn") return "Burn";
  if (kind === "freeze") return "Hold";
  if (kind === "unfreeze") return "Release";
  if (kind === "destroyFrozen") return "Destroy";
  if (kind === "emergency") return "Alert";
  return "Action";
}

function progressPercent(progress: ActionSignerProgress | undefined): number {
  if (!progress || progress.requiredPower <= 0) return 0;
  const percent = (Number(progress.signedPower) / progress.requiredPower) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

function personalStatus({
  canSign,
  hasSigned,
  isMember,
  isSupported,
}: {
  canSign: boolean;
  hasSigned: boolean;
  isMember: boolean;
  isSupported: boolean;
}): { label: string; className: string } {
  if (canSign) return { label: "Waiting for your signature", className: "urgent" };
  if (hasSigned) return { label: "Signed", className: "signed" };
  if (!isSupported) return { label: "Display only", className: "neutral" };
  if (!isMember) return { label: "Not in approval group", className: "neutral" };
  return { label: "Waiting for another signer", className: "neutral" };
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
          const hasSigned = Boolean(
            session.identityId && p?.hasSigned(session.identityId),
          );
          const isMember = Boolean(
            session.identityId && action.group.members.has(session.identityId),
          );
          const status = personalStatus({
            canSign,
            hasSigned,
            isMember,
            isSupported: Boolean(action.params),
          });
          const percent = progressPercent(p);
          const kind = actionKind(action);
          const details = action.params ? actionDetails(action.params) : [];
          return (
            <div
              key={action.actionId}
              className={`proposal-card proposal-${kind} ${hasSigned ? "is-signed" : ""} ${
                canSign ? "needs-signature" : ""
              }`}
            >
              <div className="proposal-header">
                <div>
                  <div className="proposal-title">
                    <span className="proposal-icon">{actionIcon(kind)}</span>
                    <strong>{describeGroupAction(action.eventName)}</strong>
                  </div>
                  <span className={`status-badge ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <span className="group-badge">
                  Approval group {action.group.groupPosition}
                </span>
              </div>

              <div className="proposal-progress">
                <div className="row between">
                  <span>
                    {p
                      ? `${p.signedPower.toString()} / ${p.requiredPower} voting power`
                      : "Signer progress loading"}
                  </span>
                  <strong>{percent}%</strong>
                </div>
                <div
                  className="progress"
                  role="progressbar"
                  aria-label="Signature progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <span style={{ width: `${percent}%` }} />
                </div>
              </div>

              {action.params?.kind === "emergency" && (
                <div className="proposal-callout">Applies to the entire token</div>
              )}

              <div className="metadata-grid">
                {details.map((detail) => (
                  <div
                    key={detail.label}
                    className={detail.prominent ? "metadata-item primary" : "metadata-item"}
                  >
                    <span>{detail.label}</span>
                    <strong>{detail.value}</strong>
                  </div>
                ))}
                <div className="metadata-item">
                  <span>Proposed by</span>
                  <strong>
                    <CopyableId id={action.proposerId} len={8} />
                  </strong>
                </div>
                <div className="metadata-item technical">
                  <span>Action ID</span>
                  <strong>
                    <CopyableId id={action.actionId} len={8} />
                  </strong>
                </div>
              </div>

              {!action.params && (
                <p className="muted">
                  This proposal type is display-only in TokenOps v1.
                </p>
              )}
              <div className="proposal-actions">
                {canSign && (
                  <button
                    type="button"
                    disabled={busyActionId === action.actionId}
                    onClick={() => void coSign(action)}
                  >
                    {busyActionId === action.actionId ? "Co-signing..." : "Co-sign"}
                  </button>
                )}
                {hasSigned && <span className="signed-note">Signed by this identity</span>}
              </div>
            </div>
          );
        })}
        {actions.length === 0 && <p className="muted">No pending actions.</p>}
      </div>
    </div>
  );
}
