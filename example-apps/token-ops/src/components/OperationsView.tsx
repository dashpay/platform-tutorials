import { useEffect, useState } from "react";

import {
  DEFAULT_ACTION_GROUP_POSITIONS,
  type TokenActionKind,
} from "../dash/contract";
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

export function OperationsView({ onComplete }: { onComplete?: () => void }) {
  const session = useSession();
  const [groups, setGroups] = useState<TokenOpsGroupInfo[]>([]);
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [amount, setAmount] = useState("1");
  const [recipientId, setRecipientId] = useState("");
  const [targetIdentityId, setTargetIdentityId] = useState("");
  const [actionId, setActionId] = useState("");
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

  if (session.status !== "authenticated") {
    return <div className="notice info">Sign in to submit token operations.</div>;
  }

  const common = {
    sdk: session.sdk!,
    keyManager: session.keyManager!,
    contractId: session.contractId!,
    log: session.log,
  };
  const pendingActionId = actionId.trim() || undefined;
  const signedInIdentityId = session.identityId;

  function actionRule(kind: TokenActionKind): RuleInfo | undefined {
    return rules.find((rule) => rule.key === ACTION_RULE_KEYS[kind]);
  }

  function actionPermission(kind: TokenActionKind): {
    canSubmit: boolean;
    groupPosition: number;
    reason: string | undefined;
  } {
    const rule = actionRule(kind);
    if (rule && rule.operator.type !== "Group") {
      return {
        canSubmit: false,
        groupPosition: groupFor(kind, rules),
        reason: `Current operator is ${rule.operator.type}; this form supports group-operated actions.`,
      };
    }
    const groupPosition = groupFor(kind, rules);
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
        reason: `Requires membership in group ${groupPosition}.`,
      };
    }
    return { canSubmit: true, groupPosition, reason: undefined };
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

  return (
    <div>
      {error && <div className="notice error">{error}</div>}
      {governanceError && <div className="notice error">{governanceError}</div>}
      {governanceLoaded && !canSubmitAnyGroupAction && (
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
      <div className="card">
        <h3>Group-managed operations</h3>
        <p className="muted">
          Leave Action ID blank to propose. Paste a pending action ID to co-sign
          that existing group action.
        </p>
        <p className="muted">
          {memberships.length > 0
            ? `Signed-in identity is a member of group ${memberships.join(", group ")}.`
            : "Signed-in identity is not a member of any loaded TokenOps group."}
        </p>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="amount">Amount</label>
            <input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="action-id">Action ID for co-sign</label>
            <input
              id="action-id"
              value={actionId}
              onChange={(e) => setActionId(e.target.value)}
              placeholder="optional"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="recipient">Recipient identity ID</label>
          <input
            id="recipient"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            placeholder="optional for mint, required for transfer"
          />
        </div>
        <div className="row wrap">
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
                  actionId: pendingActionId,
                }),
              )
            }
          >
            Mint
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || !burnPermission.canSubmit}
            title={burnPermission.reason}
            onClick={() =>
              run("Burn", () =>
                burnToken({
                  ...common,
                  amount: toAmount(amount),
                  groupPosition: burnPermission.groupPosition,
                  actionId: pendingActionId,
                }),
              )
            }
          >
            Burn
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || !recipientId.trim()}
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
      </div>

      <div className="card">
        <h3>Access and emergency actions</h3>
        <div className="field">
          <label htmlFor="target-identity">Target identity ID</label>
          <input
            id="target-identity"
            value={targetIdentityId}
            onChange={(e) => setTargetIdentityId(e.target.value)}
          />
        </div>
        <div className="row wrap">
          <button
            type="button"
            disabled={
              Boolean(busy) || !targetIdentityId.trim() || !freezePermission.canSubmit
            }
            title={freezePermission.reason}
            onClick={() =>
              run("Freeze", () =>
                freezeToken({
                  ...common,
                  targetIdentityId,
                  groupPosition: freezePermission.groupPosition,
                  actionId: pendingActionId,
                }),
              )
            }
          >
            Freeze
          </button>
          <button
            type="button"
            disabled={
              Boolean(busy) ||
              !targetIdentityId.trim() ||
              !unfreezePermission.canSubmit
            }
            title={unfreezePermission.reason}
            onClick={() =>
              run("Unfreeze", () =>
                unfreezeToken({
                  ...common,
                  targetIdentityId,
                  groupPosition: unfreezePermission.groupPosition,
                  actionId: pendingActionId,
                }),
              )
            }
          >
            Unfreeze
          </button>
          <button
            type="button"
            className="danger"
            disabled={
              Boolean(busy) ||
              !targetIdentityId.trim() ||
              !destroyFrozenPermission.canSubmit
            }
            title={destroyFrozenPermission.reason}
            onClick={() =>
              run("Destroy frozen funds", () =>
                destroyFrozenToken({
                  ...common,
                  targetIdentityId,
                  groupPosition: destroyFrozenPermission.groupPosition,
                  actionId: pendingActionId,
                }),
              )
            }
          >
            Destroy frozen
          </button>
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
                  actionId: pendingActionId,
                }),
              )
            }
          >
            Pause
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
                  actionId: pendingActionId,
                }),
              )
            }
          >
            Resume
          </button>
        </div>
        {busy && <p className="muted">Submitting {busy}...</p>}
      </div>
    </div>
  );
}
