import { useEffect, useMemo, useState } from "react";

import { ConfirmActionPanel } from "./ConfirmActionPanel";
import { CopyableId } from "./CopyableId";
import { IdentityLabel } from "./IdentityLabel";
import { errorMessage } from "../dash/logger";
import {
  fetchTokenOpsGovernance,
  type RuleInfo,
  type TokenOpsGroupInfo,
} from "../dash/governance";
import { formatGroupIdentity } from "../dash/groupDisplay";
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
import { CapabilityIcon } from "../lib/capabilityIcon";
import { useDpnsNames } from "../hooks/useDpnsNames";
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
  dpnsNames: Record<string, string | null>,
): { label: string; value: React.ReactNode; prominent?: boolean }[] {
  switch (params.kind) {
    case "mint":
      return [
        {
          label: "Recipient",
          value: (
            <IdentityLabel
              id={params.recipientId}
              dpnsNames={dpnsNames}
              len={8}
            />
          ),
          prominent: true,
        },
        { label: "Amount", value: params.amount.toString(), prominent: true },
      ];
    case "burn":
      return [
        {
          label: "Burn from",
          value: (
            <IdentityLabel
              id={params.burnFromId}
              dpnsNames={dpnsNames}
              len={8}
            />
          ),
          prominent: true,
        },
        { label: "Amount", value: params.amount.toString(), prominent: true },
      ];
    case "freeze":
    case "unfreeze":
      return [
        {
          label: "Target",
          value: (
            <IdentityLabel
              id={params.targetIdentityId}
              dpnsNames={dpnsNames}
              len={8}
            />
          ),
          prominent: true,
        },
      ];
    case "destroyFrozen":
      return [
        {
          label: "Target",
          value: (
            <IdentityLabel
              id={params.targetIdentityId}
              dpnsNames={dpnsNames}
              len={8}
            />
          ),
          prominent: true,
        },
        ...(params.amount != null
          ? [
              {
                label: "Amount",
                value: params.amount.toString(),
                prominent: true,
              },
            ]
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
  return (
    describeGroupAction(action.eventName).toLowerCase().split(" ")[0] ?? "other"
  );
}

function actionTitle(action: PendingWithGroup): string {
  if (!action.params) return describeGroupAction(action.eventName);
  if (action.params.kind === "mint")
    return `Mint ${action.params.amount.toString()}`;
  if (action.params.kind === "burn")
    return `Burn ${action.params.amount.toString()}`;
  if (action.params.kind === "freeze") return "Freeze balance";
  if (action.params.kind === "unfreeze") return "Unfreeze balance";
  if (action.params.kind === "destroyFrozen") return "Destroy frozen funds";
  if (action.params.kind === "emergency") {
    return action.params.action === "pause" ? "Pause token" : "Resume token";
  }
  return describeGroupAction(action.eventName);
}

function actionSubject(
  params: PendingTokenActionParams | null,
): { label: string; id: string } | null {
  if (!params) return null;
  if (params.kind === "mint")
    return { label: "Recipient", id: params.recipientId };
  if (params.kind === "burn") return { label: "From", id: params.burnFromId };
  if (params.kind === "freeze" || params.kind === "unfreeze") {
    return { label: "Target", id: params.targetIdentityId };
  }
  if (params.kind === "destroyFrozen") {
    return { label: "Target", id: params.targetIdentityId };
  }
  return null;
}

function progressPercent(
  progress: ActionSignerProgress | undefined,
  requiredPower: number,
): number {
  if (!progress || requiredPower <= 0) return 0;
  const percent = (Number(progress.signedPower) / requiredPower) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

function signedMemberCount(
  action: PendingWithGroup,
  signerProgress: ActionSignerProgress | undefined,
): number {
  if (!signerProgress) return 0;
  return [...signerProgress.signers.keys()].filter((identityId) =>
    action.group.members.has(identityId),
  ).length;
}

function usesOnePowerPerSignature(group: TokenOpsGroupInfo): boolean {
  return [...group.members.values()].every((power) => power === 1);
}

function approvalGroupRequirementText(group: TokenOpsGroupInfo): string {
  if (usesOnePowerPerSignature(group)) {
    return `${group.requiredPower} of ${group.members.size} signatures required`;
  }
  return `${group.requiredPower} voting power from ${group.members.size} signers`;
}

function signatureProgressText(
  action: PendingWithGroup,
  signerProgress: ActionSignerProgress | undefined,
): string {
  if (!signerProgress) return "signatures loading";
  const signedCount = signedMemberCount(action, signerProgress);
  if (usesOnePowerPerSignature(action.group)) {
    return `${signedCount} of ${action.group.requiredPower} signatures received`;
  }
  return `${signedCount} signer${signedCount === 1 ? "" : "s"} · ${signerProgress.signedPower.toString()} of ${action.group.requiredPower} power`;
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
  if (canSign)
    return { label: "Waiting for your signature", className: "urgent" };
  if (hasSigned) return { label: "Signed by you", className: "signed" };
  if (!isSupported) return { label: "Display only", className: "neutral" };
  if (!isMember)
    return { label: "Not in approval group", className: "neutral" };
  return { label: "Waiting for another signer", className: "neutral" };
}

export function PendingActionsView() {
  const session = useSession();
  const [actions, setActions] = useState<PendingWithGroup[]>([]);
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [progress, setProgress] = useState<Map<string, ActionSignerProgress>>(
    new Map(),
  );
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(
    null,
  );
  const [expandedActionIds, setExpandedActionIds] = useState<Set<string>>(
    new Set(),
  );
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    if (!session.sdk || !session.contractId) return;
    setError(null);
    setRefreshing(true);
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
      setRules(governance.rules);
      setProgress(nextProgress);
      setLastUpdatedAt(new Date());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sdk, session.contractId]);

  async function coSign(action: PendingWithGroup) {
    if (
      !session.sdk ||
      !session.keyManager ||
      !session.contractId ||
      !action.params
    ) {
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
      setConfirmingActionId(null);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyActionId(null);
    }
  }

  function actionCommand(action: PendingWithGroup): string {
    if (!action.params)
      return describeGroupAction(action.eventName).toLowerCase();
    if (action.params.kind === "destroyFrozen") return "destroy frozen funds";
    if (action.params.kind === "emergency") return action.params.action;
    return action.params.kind;
  }

  function isDestructiveAction(action: PendingWithGroup): boolean {
    return (
      action.params?.kind === "burn" || action.params?.kind === "destroyFrozen"
    );
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

  const identityIds = useMemo(
    () => [
      session.identityId,
      ...actions.flatMap((action) => [
        action.proposerId,
        ...action.group.members.keys(),
        action.params?.kind === "mint" ? action.params.recipientId : undefined,
        action.params?.kind === "burn" ? action.params.burnFromId : undefined,
        action.params?.kind === "freeze" ||
        action.params?.kind === "unfreeze" ||
        action.params?.kind === "destroyFrozen"
          ? action.params.targetIdentityId
          : undefined,
      ]),
      ...[...progress.values()].flatMap((p) => [...p.signers.keys()]),
    ],
    [actions, progress, session.identityId],
  );
  const dpnsNames = useDpnsNames(session.sdk, identityIds);

  return (
    <div className="pending-screen">
      {error && <div className="notice error">{error}</div>}
      <div className="pending-toolbar">
        <div>
          <h3>Pending group actions</h3>
          <p className="muted">
            Eligible unsigned group members can co-sign supported token
            proposals directly from this list.
          </p>
        </div>
        <div className="pending-toolbar-actions">
          <span className="muted">
            {refreshing
              ? "Refreshing..."
              : lastUpdatedAt
                ? `Updated ${lastUpdatedAt.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}`
                : "Loading..."}
          </span>
          <button
            type="button"
            className="secondary"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            Refresh
          </button>
        </div>
      </div>

      {actions.length === 0 ? (
        <div className="empty-state">
          <strong>No pending actions</strong>
          <span>Use Operations to propose a group-governed token action.</span>
        </div>
      ) : (
        (() => {
          const enriched = actions
            .map((action) => {
              const p = progress.get(action.actionId);
              const canSign = canCurrentIdentitySign(action, p);
              const hasSigned = Boolean(
                session.identityId && p?.hasSigned(session.identityId),
              );
              const isMember = Boolean(
                session.identityId &&
                action.group.members.has(session.identityId),
              );
              const status = personalStatus({
                canSign,
                hasSigned,
                isMember,
                isSupported: Boolean(action.params),
              });
              return { action, p, canSign, hasSigned, isMember, status };
            })
            .sort((a, b) => Number(b.canSign) - Number(a.canSign));
          const needsSignature = enriched.filter((item) => item.canSign);
          const waiting = enriched.filter((item) => !item.canSign);
          const renderCard = ({
            action,
            p,
            canSign,
            hasSigned,
            isMember,
            status,
          }: (typeof enriched)[number]) => {
            const percent = progressPercent(p, action.group.requiredPower);
            const kind = actionKind(action);
            const details = action.params
              ? actionDetails(action.params, dpnsNames)
              : [];
            const isExpanded = expandedActionIds.has(action.actionId);
            const visibleDetails = isExpanded ? details : [];
            const signedCount = signedMemberCount(action, p);
            const unitPowerGroup = usesOnePowerPerSignature(action.group);
            const requiredSlots = unitPowerGroup
              ? Math.max(1, action.group.requiredPower)
              : Math.max(1, action.group.members.size);
            const signedSlots = Math.max(
              0,
              Math.min(requiredSlots, signedCount),
            );
            const subject = actionSubject(action.params);
            const proposedByCurrentIdentity =
              session.identityId === action.proposerId;
            const myPower =
              session.identityId != null
                ? (action.group.members.get(session.identityId) ?? 0)
                : 0;
            const willExecute = p
              ? Number(p.signedPower) + myPower >= action.group.requiredPower
              : false;
            const signaturesNeededAfterMine = p
              ? Math.max(
                  0,
                  action.group.requiredPower -
                    (Number(p.signedPower) + myPower),
                )
              : 0;
            const requiresConfirm =
              canSign && (willExecute || isDestructiveAction(action));
            const isConfirming = confirmingActionId === action.actionId;
            const command = actionCommand(action);
            return (
              <div
                key={action.actionId}
                className={`proposal-card proposal-${kind} ${
                  isExpanded ? "is-expanded" : "is-collapsed"
                } ${hasSigned ? "is-signed" : ""} ${
                  canSign ? "needs-signature" : ""
                } ${!canSign ? "waiting-on-others" : ""}`}
              >
                <div className="proposal-header">
                  <div>
                    <div className="proposal-title">
                      <CapabilityIcon kind={kind} className="proposal-icon" />
                      <div className="proposal-title-copy">
                        <strong>{actionTitle(action)}</strong>
                        {subject && (
                          <div className="proposal-subtitle">
                            <span>{subject.label}</span>
                            <IdentityLabel
                              id={subject.id}
                              dpnsNames={dpnsNames}
                              len={8}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`status-badge ${status.className}`}>
                    {formatGroupIdentity(action.group.groupPosition, rules)} •{" "}
                    {canSign ? "Awaiting you" : status.label}
                  </span>
                </div>

                <div className="proposal-progress">
                  <div className="row between">
                    <span>
                      {p
                        ? `${p.signedPower.toString()} / ${action.group.requiredPower} signatures`
                        : "Signer progress loading"}
                    </span>
                    <strong>{percent}%</strong>
                  </div>
                  <div
                    className="progress signature-progress"
                    role="progressbar"
                    aria-label="Signature progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                  >
                    {Array.from({ length: requiredSlots }, (_, index) => (
                      <span
                        key={index}
                        className={
                          index < signedSlots
                            ? "progress-segment filled"
                            : "progress-segment"
                        }
                      />
                    ))}
                  </div>
                </div>

                {isExpanded && action.params?.kind === "emergency" && (
                  <div className="proposal-callout">
                    Applies to the entire token
                  </div>
                )}

                <div className={`metadata-grid ${isExpanded ? "" : "compact"}`}>
                  {visibleDetails.map((detail) => (
                    <div
                      key={detail.label}
                      className={
                        detail.prominent
                          ? "metadata-item primary"
                          : "metadata-item"
                      }
                    >
                      <span>{detail.label}</span>
                      <strong>{detail.value}</strong>
                    </div>
                  ))}
                  {isExpanded && (
                    <div className="metadata-item">
                      <span>Approval group</span>
                      <strong>
                        {formatGroupIdentity(action.group.groupPosition, rules)}{" "}
                        · {approvalGroupRequirementText(action.group)}
                      </strong>
                    </div>
                  )}
                  {isExpanded && (
                    <div className="metadata-item">
                      <span>Proposed by</span>
                      <strong>
                        {proposedByCurrentIdentity ? (
                          "You"
                        ) : (
                          <IdentityLabel
                            id={action.proposerId}
                            dpnsNames={dpnsNames}
                            len={8}
                          />
                        )}
                      </strong>
                    </div>
                  )}
                  {!isExpanded && (
                    <div className="metadata-item">
                      <strong>
                        {p
                          ? `${signatureProgressText(action, p)}${
                              !isMember ? " · you're not in this group" : ""
                            }`
                          : "Loading"}
                      </strong>
                    </div>
                  )}
                  {isExpanded && (
                    <div className="metadata-item technical">
                      <span>Action ID</span>
                      <strong>
                        <CopyableId id={action.actionId} len={8} />
                      </strong>
                    </div>
                  )}
                </div>

                {!action.params && (
                  <p className="muted">
                    This proposal type is display-only in TokenOps v1.
                  </p>
                )}
                <div className="proposal-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setExpandedActionIds((previous) => {
                        const next = new Set(previous);
                        if (next.has(action.actionId))
                          next.delete(action.actionId);
                        else next.add(action.actionId);
                        return next;
                      })
                    }
                  >
                    {isExpanded ? "Hide details" : "Details"}
                  </button>
                  {canSign && (
                    <>
                      {isConfirming ? (
                        <ConfirmActionPanel
                          title={
                            willExecute
                              ? `Sign and execute ${command}`
                              : `Confirm signature for ${command}`
                          }
                          summary={
                            willExecute
                              ? `Your signature will meet the ${action.group.requiredPower} signature threshold.`
                              : "Add your signature to this destructive pending action."
                          }
                          consequence={
                            willExecute
                              ? "Signing runs this action on-chain now and cannot be undone."
                              : "This action is destructive if it later reaches threshold."
                          }
                          confirmLabel={
                            willExecute
                              ? `Sign & execute ${command}`
                              : "Add your signature"
                          }
                          tone="danger"
                          busy={busyActionId === action.actionId}
                          onCancel={() => setConfirmingActionId(null)}
                          onConfirm={() => void coSign(action)}
                        />
                      ) : (
                        <div className="signature-action-stack">
                          <button
                            type="button"
                            className={willExecute ? "danger" : "secondary"}
                            disabled={busyActionId === action.actionId}
                            onClick={() =>
                              requiresConfirm
                                ? setConfirmingActionId(action.actionId)
                                : void coSign(action)
                            }
                          >
                            {busyActionId === action.actionId
                              ? "Signing..."
                              : willExecute
                                ? `Sign & execute ${command}`
                                : "Add your signature"}
                          </button>
                          {!willExecute && (
                            <span className="signature-action-helper">
                              {signaturesNeededAfterMine} more{" "}
                              {signaturesNeededAfterMine === 1
                                ? "signature"
                                : "signatures"}{" "}
                              needed after yours
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          };
          return (
            <div className="pending-sections">
              {needsSignature.length > 0 && (
                <section className="pending-section">
                  <h3>
                    Needs your signature{" "}
                    <span className="count-badge">{needsSignature.length}</span>
                  </h3>
                  {needsSignature.map(renderCard)}
                </section>
              )}
              <section className="pending-section">
                <h3>Waiting on others</h3>
                {waiting.map(renderCard)}
              </section>
            </div>
          );
        })()
      )}
    </div>
  );
}
