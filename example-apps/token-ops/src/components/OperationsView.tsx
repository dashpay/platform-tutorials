import { useEffect, useState } from "react";

import {
  DEFAULT_ACTION_GROUP_POSITIONS,
  type TokenActionKind,
} from "../dash/contract";
import { formatGroupIdentity } from "../dash/groupDisplay";
import {
  fetchTokenOpsGovernance,
  type RuleInfo,
  type TokenOpsGroupInfo,
} from "../dash/governance";
import { errorMessage } from "../dash/logger";
import {
  burnToken,
  destroyFrozenToken,
  emergencyTokenAction,
  freezeToken,
  mintToken,
  transferToken,
  unfreezeToken,
} from "../dash/tokenOperations";
import { CapabilityIcon } from "../lib/capabilityIcon";
import { useSession } from "../session/useSession";

function toAmount(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) throw new Error("Amount must be a whole number.");
  return BigInt(trimmed);
}

const ACTION_RULE_KEYS: Record<TokenActionKind, string> = {
  mint: "manualMinting",
  burn: "manualBurning",
  freeze: "freeze",
  unfreeze: "unfreeze",
  destroyFrozen: "destroyFrozenFunds",
  emergency: "emergencyAction",
};

function groupFor(kind: TokenActionKind, rules: RuleInfo[]): number {
  const rule = rules.find((candidate) => candidate.key === ACTION_RULE_KEYS[kind]);
  if (rule?.operator.type === "Group" && rule.operator.groupPosition !== undefined) {
    return rule.operator.groupPosition;
  }
  return DEFAULT_ACTION_GROUP_POSITIONS[kind];
}

function groupRequiredPower(
  position: number,
  groups: TokenOpsGroupInfo[],
): number | undefined {
  return groups.find((group) => group.groupPosition === position)?.requiredPower;
}

function groupMeta(
  position: number,
  groups: TokenOpsGroupInfo[],
  rules: RuleInfo[],
): string {
  const requiredPower = groupRequiredPower(position, groups);
  return `${formatGroupIdentity(position, rules)}${
    requiredPower && requiredPower > 0
      ? ` - ${requiredPower} signatures required`
      : ""
  }`;
}

export function OperationsView({ onComplete }: { onComplete?: () => void }) {
  const session = useSession();
  const [groups, setGroups] = useState<TokenOpsGroupInfo[]>([]);
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [amount, setAmount] = useState("1");
  const [recipientId, setRecipientId] = useState("");
  const [targetIdentityId, setTargetIdentityId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [governanceError, setGovernanceError] = useState<string | null>(null);

  async function refreshGovernance() {
    if (!session.sdk || !session.contractId) return;
    setGovernanceError(null);
    try {
      const governance = await fetchTokenOpsGovernance({
        sdk: session.sdk,
        contractId: session.contractId,
      });
      setGroups(governance.groups);
      setRules(governance.rules);
    } catch (err) {
      setGovernanceError(errorMessage(err));
      setGroups([]);
      setRules([]);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshGovernance(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sdk, session.contractId]);

  async function run(label: string, fn: () => Promise<unknown>) {
    if (!session.sdk || !session.keyManager || !session.contractId) return;
    setBusy(label);
    setError(null);
    try {
      await fn();
      session.log(`${label} submitted.`, "success");
      onComplete?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const isAuthenticated = session.status === "authenticated";
  const common = {
    sdk: session.sdk!,
    keyManager: session.keyManager!,
    contractId: session.contractId!,
    log: session.log,
  };
  const signedInIdentityId = session.identityId;

  function actionRule(kind: TokenActionKind): RuleInfo | undefined {
    return rules.find((rule) => rule.key === ACTION_RULE_KEYS[kind]);
  }

  function actionPermission(kind: TokenActionKind): {
    canSubmit: boolean;
    groupPosition: number;
    reason: string | undefined;
  } {
    const groupPosition = groupFor(kind, rules);
    if (!isAuthenticated) {
      return {
        canSubmit: false,
        groupPosition,
        reason: "Sign in to propose this action.",
      };
    }
    const rule = actionRule(kind);
    if (rule && rule.operator.type !== "Group") {
      return {
        canSubmit: false,
        groupPosition,
        reason: `Current operator is ${rule.operator.type}; this form supports group-operated actions.`,
      };
    }
    const group = groups.find((candidate) => candidate.groupPosition === groupPosition);
    if (!group) {
      return {
        canSubmit: false,
        groupPosition,
        reason: `Group ${groupPosition} is not loaded yet.`,
      };
    }
    if (!signedInIdentityId || !group.members.has(signedInIdentityId)) {
      return {
        canSubmit: false,
        groupPosition,
        reason: `Requires membership in ${formatGroupIdentity(groupPosition, rules)}.`,
      };
    }
    return { canSubmit: true, groupPosition, reason: undefined };
  }

  function disabledReason(
    permission: { canSubmit: boolean; reason: string | undefined },
    inputReason?: string,
  ): string | undefined {
    return permission.reason ?? inputReason;
  }

  function confirmBurn(): boolean {
    const cleanAmount = amount.trim();
    return window.confirm(
      `Propose irreversible burn of ${cleanAmount} token(s) from the signed-in identity?`,
    );
  }

  function confirmDestroyFrozen(): boolean {
    const target = targetIdentityId.trim();
    return window.confirm(
      `Propose permanent destruction of frozen funds for ${target}?`,
    );
  }

  const mintPermission = actionPermission("mint");
  const burnPermission = actionPermission("burn");
  const freezePermission = actionPermission("freeze");
  const unfreezePermission = actionPermission("unfreeze");
  const destroyFrozenPermission = actionPermission("destroyFrozen");
  const emergencyPermission = actionPermission("emergency");
  const groupActionPermissions = [
    mintPermission,
    burnPermission,
    freezePermission,
    unfreezePermission,
    destroyFrozenPermission,
    emergencyPermission,
  ];
  const canSubmitAnyGroupAction = groupActionPermissions.some(
    (permission) => permission.canSubmit,
  );
  const governanceLoaded = groups.length > 0 && rules.length > 0;
  const memberships = groups
    .filter((group) => signedInIdentityId && group.members.has(signedInIdentityId))
    .map((group) => group.groupPosition);
  const supplyLockedReason =
    isAuthenticated && !mintPermission.canSubmit && !burnPermission.canSubmit
      ? (mintPermission.reason ?? burnPermission.reason)
      : undefined;
  const accessLockedReason =
    isAuthenticated &&
    !freezePermission.canSubmit &&
    !unfreezePermission.canSubmit &&
    !destroyFrozenPermission.canSubmit
      ? (freezePermission.reason ??
        unfreezePermission.reason ??
        destroyFrozenPermission.reason)
      : undefined;
  const emergencyLockedReason =
    isAuthenticated && !emergencyPermission.canSubmit
      ? (emergencyPermission.reason ?? destroyFrozenPermission.reason)
      : undefined;

  return (
    <div className="operations-screen">
      {error && <div className="notice error">{error}</div>}
      {governanceError && <div className="notice error">{governanceError}</div>}
      {!isAuthenticated && (
        <div className="notice info">
          Sign in to propose or run token operations. This view remains available
          so you can inspect supported token capabilities and governance groups.
        </div>
      )}
      {isAuthenticated && governanceLoaded && !canSubmitAnyGroupAction && (
        <div className="notice warning prominent">
          <strong>No group operation permissions</strong>
          <span>
            This identity is not a member of any operator group for mint, burn,
            freeze, unfreeze, destroy frozen funds, or emergency pause/resume.
            Group-managed actions are disabled. Token transfer can still be used
            when this identity holds tokens.
          </span>
        </div>
      )}

      <section className="eligibility-strip">
        <span
          className={`eligibility-pill ${
            isAuthenticated && memberships.length > 0 ? "can-submit" : "blocked"
          }`}
        >
          {isAuthenticated ? "Eligibility" : "Read-only"}
        </span>
        <p>
          {!isAuthenticated
            ? "Operations are visible without signing in; submission controls are disabled."
            : memberships.length > 0
            ? `You're a member of ${memberships
                .map((position) => formatGroupIdentity(position, rules))
                .join(", ")}. Groups you don't belong to collapse to a locked line.`
            : "This identity is not a member of any loaded operator group. Governed actions are locked."}
        </p>
      </section>

      <div className="operation-group-list">
        <section className="operation-group supply">
          <div className="operation-group-head">
            <div>
              <CapabilityIcon
                kind="mint"
                accent="green"
                className="operation-capability-icon"
              />
              <h3>Supply</h3>
              <p>{groupMeta(mintPermission.groupPosition, groups, rules)}</p>
            </div>
          </div>
          {supplyLockedReason ? (
            <p className="locked-line">{supplyLockedReason}</p>
          ) : (
            <div className="operation-inline-form supply-form">
              <input
                aria-label="Supply amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <input
                aria-label="Supply recipient identity ID"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                placeholder="Recipient - optional for mint"
              />
              <button
                type="button"
                disabled={Boolean(busy) || !mintPermission.canSubmit}
                title={mintPermission.reason}
                onClick={() =>
                  run("Mint", () =>
                    mintToken({
                      ...common,
                      amount: toAmount(amount),
                      recipientId,
                      groupPosition: mintPermission.groupPosition,
                    }),
                  )
                }
              >
                Propose mint
              </button>
              <button
                type="button"
                className="danger-outline"
                disabled={Boolean(busy) || !burnPermission.canSubmit}
                title={burnPermission.reason}
                onClick={() => {
                  if (!confirmBurn()) return;
                  void run("Burn", () =>
                    burnToken({
                      ...common,
                      amount: toAmount(amount),
                      groupPosition: burnPermission.groupPosition,
                    }),
                  );
                }}
              >
                Propose burn...
              </button>
            </div>
          )}
        </section>

        <section className="operation-group access">
          <div className="operation-group-head">
            <div>
              <CapabilityIcon
                kind="freeze"
                accent="orange"
                className="operation-capability-icon"
              />
              <h3>Access</h3>
              <p>{groupMeta(freezePermission.groupPosition, groups, rules)}</p>
            </div>
          </div>
          {accessLockedReason ? (
            <p className="locked-line">{accessLockedReason}</p>
          ) : (
            <div className="operation-inline-form access-form">
              <input
                aria-label="Access target identity ID"
                value={targetIdentityId}
                onChange={(e) => setTargetIdentityId(e.target.value)}
                placeholder="Target identity ID"
              />
              <button
                type="button"
                disabled={
                  Boolean(busy) ||
                  !targetIdentityId.trim() ||
                  !freezePermission.canSubmit
                }
                title={disabledReason(
                  freezePermission,
                  !targetIdentityId.trim()
                    ? "Enter a target identity ID."
                    : undefined,
                )}
                onClick={() =>
                  run("Freeze", () =>
                    freezeToken({
                      ...common,
                      targetIdentityId,
                      groupPosition: freezePermission.groupPosition,
                    }),
                  )
                }
              >
                Propose freeze
              </button>
              <button
                type="button"
                disabled={
                  Boolean(busy) ||
                  !targetIdentityId.trim() ||
                  !unfreezePermission.canSubmit
                }
                title={disabledReason(
                  unfreezePermission,
                  !targetIdentityId.trim()
                    ? "Enter a target identity ID."
                    : undefined,
                )}
                onClick={() =>
                  run("Unfreeze", () =>
                    unfreezeToken({
                      ...common,
                      targetIdentityId,
                      groupPosition: unfreezePermission.groupPosition,
                    }),
                  )
                }
              >
                Propose unfreeze
              </button>
              <button
                type="button"
                className="danger-outline"
                disabled={
                  Boolean(busy) ||
                  !targetIdentityId.trim() ||
                  !destroyFrozenPermission.canSubmit
                }
                title={disabledReason(
                  destroyFrozenPermission,
                  !targetIdentityId.trim()
                    ? "Enter a frozen target identity ID."
                    : undefined,
                )}
                onClick={() => {
                  if (!confirmDestroyFrozen()) return;
                  void run("Destroy frozen funds", () =>
                    destroyFrozenToken({
                      ...common,
                      targetIdentityId,
                      groupPosition: destroyFrozenPermission.groupPosition,
                    }),
                  );
                }}
              >
                Destroy frozen...
              </button>
            </div>
          )}
        </section>

        <section className="operation-group emergency">
          <div className="operation-group-head">
            <div>
              <CapabilityIcon
                kind="emergency"
                accent="purple"
                className="operation-capability-icon"
              />
              <h3>Emergency</h3>
              <p>{groupMeta(emergencyPermission.groupPosition, groups, rules)}</p>
            </div>
          </div>
          {emergencyLockedReason ? (
            <p className="locked-line">{emergencyLockedReason}</p>
          ) : (
            <div className="operation-inline-form emergency-form">
              <button
                type="button"
                disabled={Boolean(busy) || !emergencyPermission.canSubmit}
                title={emergencyPermission.reason}
                onClick={() =>
                  run("Pause", () =>
                    emergencyTokenAction({
                      ...common,
                      action: "pause",
                      groupPosition: emergencyPermission.groupPosition,
                    }),
                  )
                }
              >
                Propose pause
              </button>
              <button
                type="button"
                disabled={Boolean(busy) || !emergencyPermission.canSubmit}
                title={emergencyPermission.reason}
                onClick={() =>
                  run("Resume", () =>
                    emergencyTokenAction({
                      ...common,
                      action: "resume",
                      groupPosition: emergencyPermission.groupPosition,
                    }),
                  )
                }
              >
                Propose resume
              </button>
            </div>
          )}
        </section>

        <section className="operation-group transfer direct">
          <div className="operation-group-head">
            <div>
              <h3>Transfer</h3>
              <p>Direct - no proposal</p>
            </div>
          </div>
          <div className="operation-inline-form transfer-form">
            <input
              aria-label="Transfer amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              aria-label="Transfer recipient identity ID"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              placeholder="Recipient identity ID"
            />
            <button
              type="button"
              disabled={Boolean(busy) || !isAuthenticated || !recipientId.trim()}
              title={
                !isAuthenticated
                  ? "Sign in to transfer tokens."
                  : !recipientId.trim()
                    ? "Enter a recipient identity ID."
                    : undefined
              }
              onClick={() =>
                run("Transfer", () =>
                  transferToken({
                    ...common,
                    amount: toAmount(amount),
                    recipientId,
                  }),
                )
              }
            >
              Transfer
            </button>
          </div>
        </section>
      </div>
      {busy && <p className="muted">Submitting {busy}...</p>}
    </div>
  );
}
