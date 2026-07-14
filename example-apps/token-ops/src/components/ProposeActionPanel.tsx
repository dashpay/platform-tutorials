import { useState } from "react";

import { ConfirmActionPanel } from "./ConfirmActionPanel";
import {
  DEFAULT_ACTION_GROUP_POSITIONS,
  type TokenActionKind,
} from "../dash/contract";
import { formatGroupIdentity } from "../dash/groupDisplay";
import { type RuleInfo, type TokenOpsGovernance } from "../dash/governance";
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
  const rule = rules.find(
    (candidate) => candidate.key === ACTION_RULE_KEYS[kind],
  );
  if (
    rule?.operator.type === "Group" &&
    rule.operator.groupPosition !== undefined
  ) {
    return rule.operator.groupPosition;
  }
  return DEFAULT_ACTION_GROUP_POSITIONS[kind];
}

type GroupProposalKind =
  | "mint"
  | "burn"
  | "freeze"
  | "unfreeze"
  | "destroyFrozen"
  | "pause"
  | "resume";

type ProposalKind = GroupProposalKind | "transfer";

const GROUP_PROPOSAL_OPTIONS: { kind: GroupProposalKind; label: string }[] = [
  { kind: "mint", label: "Mint" },
  { kind: "burn", label: "Burn" },
  { kind: "freeze", label: "Freeze" },
  { kind: "unfreeze", label: "Unfreeze" },
  { kind: "destroyFrozen", label: "Destroy frozen" },
  { kind: "pause", label: "Pause" },
  { kind: "resume", label: "Resume" },
];

const PROPOSAL_OPTIONS: { kind: ProposalKind; label: string }[] = [
  ...GROUP_PROPOSAL_OPTIONS,
  { kind: "transfer", label: "Transfer" },
];

function formatList(items: string[]): string {
  if (items.length < 2) return items[0] ?? "";
  if (items.length === 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function proposalLabel(kind: ProposalKind): string {
  return PROPOSAL_OPTIONS.find((option) => option.kind === kind)?.label ?? kind;
}

export function ProposeActionPanel({
  governance,
  onComplete,
}: {
  governance: TokenOpsGovernance | null;
  onComplete?: () => void;
}) {
  const session = useSession();
  const groups = governance?.groups ?? [];
  const rules = governance?.rules ?? [];
  const [proposalKind, setProposalKind] = useState<ProposalKind>("mint");
  const [amount, setAmount] = useState("1");
  const [recipientId, setRecipientId] = useState("");
  const [targetIdentityId, setTargetIdentityId] = useState("");
  const [destroyTargetIdentityId, setDestroyTargetIdentityId] = useState("");
  const [transferAmount, setTransferAmount] = useState("1");
  const [transferRecipientId, setTransferRecipientId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<
    "burn" | "destroyFrozen" | "pause" | "resume" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<unknown>) {
    if (!session.sdk || !session.keyManager || !session.contractId) return;
    setBusy(label);
    setError(null);
    try {
      await fn();
      setConfirmingAction(null);
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
    if (!rule) {
      return {
        canSubmit: false,
        groupPosition,
        reason: "No action rule is loaded for this action.",
      };
    }
    if (rule.operator.type !== "Group") {
      return {
        canSubmit: false,
        groupPosition,
        reason: `Current operator is ${rule.operator.type}; this form supports group-operated actions.`,
      };
    }
    const group = groups.find(
      (candidate) => candidate.groupPosition === groupPosition,
    );
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
    .filter(
      (group) => signedInIdentityId && group.members.has(signedInIdentityId),
    )
    .map((group) => group.groupPosition);
  const proposalPermissions: Record<GroupProposalKind, typeof mintPermission> =
    {
      mint: mintPermission,
      burn: burnPermission,
      freeze: freezePermission,
      unfreeze: unfreezePermission,
      destroyFrozen: destroyFrozenPermission,
      pause: emergencyPermission,
      resume: emergencyPermission,
    };
  const selectedPermission =
    proposalKind === "transfer" ? null : proposalPermissions[proposalKind];
  const selectedGroup = selectedPermission
    ? groups.find(
        (group) => group.groupPosition === selectedPermission.groupPosition,
      )
    : undefined;
  const availableProposalGroups = groups
    .map((group) => {
      const actions = GROUP_PROPOSAL_OPTIONS.filter(
        ({ kind }) =>
          proposalPermissions[kind].canSubmit &&
          proposalPermissions[kind].groupPosition === group.groupPosition,
      ).map(({ label }) => label);
      return actions.length > 0
        ? `${formatGroupIdentity(group.groupPosition, rules)} (${actions.join(", ")})`
        : null;
    })
    .filter((summary): summary is string => Boolean(summary));
  const cleanAmount = amount.trim();
  const cleanDestroyTargetIdentityId = destroyTargetIdentityId.trim();

  function selectProposal(kind: ProposalKind) {
    setProposalKind(kind);
    setConfirmingAction(null);
    setError(null);
  }

  return (
    <div className="operations-screen">
      {error && <div className="notice error">{error}</div>}
      {!isAuthenticated && (
        <div className="notice info">
          <strong>Read-only preview.</strong> Sign in to submit an action.
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

      <div className="actions-section-heading">
        <h2>Propose new action</h2>
      </div>
      <section className="propose-action-panel">
        <p className="proposal-availability">
          {!isAuthenticated
            ? "Explore supported token actions and their approval requirements."
            : availableProposalGroups.length > 0
              ? `You can propose for ${formatList(availableProposalGroups)}`
              : memberships.length > 0
                ? "Your groups do not currently operate these token actions."
                : "This identity is not in an operator group."}
        </p>
        <div
          className="proposal-selector"
          role="tablist"
          aria-label="Action type"
        >
          {PROPOSAL_OPTIONS.map(({ kind, label }) => {
            const permission =
              kind === "transfer" ? null : proposalPermissions[kind];
            const unavailable = Boolean(
              isAuthenticated &&
              governanceLoaded &&
              permission &&
              !permission.canSubmit,
            );
            return (
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={proposalKind === kind}
                aria-disabled={unavailable}
                className={`${proposalKind === kind ? "selected" : ""}${
                  unavailable ? " unavailable" : ""
                }`}
                title={unavailable ? permission?.reason : undefined}
                onClick={() => {
                  if (!unavailable) selectProposal(kind);
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="operation-group-list">
          {(proposalKind === "mint" || proposalKind === "burn") && (
            <section className={`proposal-fields supply ${proposalKind}`}>
              <div className="operation-inline-form supply-form">
                <input
                  aria-label={
                    proposalKind === "mint" ? "Mint amount" : "Burn amount"
                  }
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {proposalKind === "mint" && (
                  <>
                    <input
                      aria-label="Mint recipient identity ID"
                      value={recipientId}
                      onChange={(e) => setRecipientId(e.target.value)}
                      placeholder="Recipient identity — optional for mint"
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
                      Propose mint →
                    </button>
                  </>
                )}
                {proposalKind === "burn" &&
                  (confirmingAction === "burn" ? (
                    <ConfirmActionPanel
                      title="Confirm burn"
                      summary={
                        <>
                          Burn {cleanAmount || "0"} token(s) from the signed-in
                          identity.
                        </>
                      }
                      consequence="Burning is irreversible and submits an on-chain group action."
                      confirmLabel="Confirm burn"
                      tone="danger"
                      busy={busy === "Burn"}
                      onCancel={() => setConfirmingAction(null)}
                      onConfirm={() =>
                        void run("Burn", () =>
                          burnToken({
                            ...common,
                            amount: toAmount(amount),
                            groupPosition: burnPermission.groupPosition,
                          }),
                        )
                      }
                    />
                  ) : (
                    <button
                      type="button"
                      className="danger-outline"
                      disabled={Boolean(busy) || !burnPermission.canSubmit}
                      title={burnPermission.reason}
                      onClick={() => setConfirmingAction("burn")}
                    >
                      Propose burn…
                    </button>
                  ))}
              </div>
            </section>
          )}

          {(proposalKind === "freeze" || proposalKind === "unfreeze") && (
            <section className="proposal-fields access">
              <div className="operation-inline-form access-form">
                <input
                  aria-label={`${proposalKind === "freeze" ? "Freeze" : "Unfreeze"} target identity ID`}
                  value={targetIdentityId}
                  onChange={(e) => setTargetIdentityId(e.target.value)}
                  placeholder="Target identity ID"
                />
                <button
                  type="button"
                  disabled={
                    Boolean(busy) ||
                    !targetIdentityId.trim() ||
                    !(proposalKind === "freeze"
                      ? freezePermission.canSubmit
                      : unfreezePermission.canSubmit)
                  }
                  title={disabledReason(
                    proposalKind === "freeze"
                      ? freezePermission
                      : unfreezePermission,
                    !targetIdentityId.trim()
                      ? "Enter a target identity ID."
                      : undefined,
                  )}
                  onClick={() =>
                    run(
                      proposalKind === "freeze" ? "Freeze" : "Unfreeze",
                      () =>
                        proposalKind === "freeze"
                          ? freezeToken({
                              ...common,
                              targetIdentityId: targetIdentityId.trim(),
                              groupPosition: freezePermission.groupPosition,
                            })
                          : unfreezeToken({
                              ...common,
                              targetIdentityId: targetIdentityId.trim(),
                              groupPosition: unfreezePermission.groupPosition,
                            }),
                    )
                  }
                >
                  Propose {proposalKind} →
                </button>
              </div>
            </section>
          )}

          {proposalKind === "destroyFrozen" && (
            <section className="proposal-fields destroy-frozen">
              {confirmingAction === "destroyFrozen" ? (
                <ConfirmActionPanel
                  title="Confirm destroy frozen funds"
                  summary={
                    <>
                      Destroy frozen funds for identity{" "}
                      {cleanDestroyTargetIdentityId}.
                    </>
                  }
                  consequence="This permanently destroys frozen token funds on-chain and cannot be undone."
                  confirmLabel="Confirm destroy"
                  tone="danger"
                  busy={busy === "Destroy frozen funds"}
                  onCancel={() => setConfirmingAction(null)}
                  onConfirm={() =>
                    void run("Destroy frozen funds", () =>
                      destroyFrozenToken({
                        ...common,
                        targetIdentityId: cleanDestroyTargetIdentityId,
                        groupPosition: destroyFrozenPermission.groupPosition,
                      }),
                    )
                  }
                />
              ) : (
                <div className="operation-inline-form dangerous-form">
                  <input
                    aria-label="Destroy frozen target identity ID"
                    value={destroyTargetIdentityId}
                    onChange={(event) =>
                      setDestroyTargetIdentityId(event.target.value)
                    }
                    placeholder="Frozen target identity ID"
                  />
                  <button
                    type="button"
                    className="danger-outline"
                    disabled={
                      Boolean(busy) ||
                      !cleanDestroyTargetIdentityId ||
                      !destroyFrozenPermission.canSubmit
                    }
                    title={disabledReason(
                      destroyFrozenPermission,
                      !cleanDestroyTargetIdentityId
                        ? "Enter a frozen target identity ID."
                        : undefined,
                    )}
                    onClick={() => setConfirmingAction("destroyFrozen")}
                  >
                    Propose destroy frozen…
                  </button>
                </div>
              )}
            </section>
          )}

          {(proposalKind === "pause" || proposalKind === "resume") && (
            <section className="proposal-fields emergency">
              <div className="operation-inline-form emergency-form">
                {confirmingAction === proposalKind ? (
                  <ConfirmActionPanel
                    title={`Confirm token ${proposalKind}`}
                    summary={`${proposalLabel(proposalKind)} the entire token.`}
                    consequence={
                      proposalKind === "pause"
                        ? "Pausing halts token activity and submits an on-chain emergency group action."
                        : "Resuming changes the token's emergency state and submits an on-chain group action."
                    }
                    confirmLabel={`Confirm ${proposalKind}`}
                    tone="warning"
                    busy={busy === proposalLabel(proposalKind)}
                    onCancel={() => setConfirmingAction(null)}
                    onConfirm={() =>
                      void run(proposalLabel(proposalKind), () =>
                        emergencyTokenAction({
                          ...common,
                          action: proposalKind,
                          groupPosition: emergencyPermission.groupPosition,
                        }),
                      )
                    }
                  />
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(busy) || !emergencyPermission.canSubmit}
                    title={emergencyPermission.reason}
                    onClick={() => setConfirmingAction(proposalKind)}
                  >
                    Propose {proposalKind}…
                  </button>
                )}
              </div>
            </section>
          )}

          {proposalKind === "transfer" && (
            <section className="proposal-fields transfer">
              <div className="operation-inline-form transfer-form">
                <input
                  aria-label="Transfer amount"
                  value={transferAmount}
                  onChange={(event) => setTransferAmount(event.target.value)}
                />
                <input
                  aria-label="Transfer recipient identity ID"
                  value={transferRecipientId}
                  onChange={(event) =>
                    setTransferRecipientId(event.target.value)
                  }
                  placeholder="Recipient identity ID"
                />
                <button
                  type="button"
                  disabled={
                    Boolean(busy) ||
                    !isAuthenticated ||
                    !transferRecipientId.trim()
                  }
                  title={
                    !isAuthenticated
                      ? "Sign in to transfer tokens."
                      : !transferRecipientId.trim()
                        ? "Enter a recipient identity ID."
                        : undefined
                  }
                  onClick={() =>
                    run("Transfer", () =>
                      transferToken({
                        ...common,
                        amount: toAmount(transferAmount),
                        recipientId: transferRecipientId.trim(),
                      }),
                    )
                  }
                >
                  Transfer →
                </button>
              </div>
            </section>
          )}
        </div>
        <p className="proposal-context">
          {proposalKind === "transfer" ? (
            "Transfers execute directly — no group proposal or co-signatures."
          ) : selectedPermission ? (
            <>
              Creates a{" "}
              {formatGroupIdentity(selectedPermission.groupPosition, rules)}{" "}
              action.
              {selectedGroup && selectedGroup.requiredPower > 0 && (
                <>
                  {" "}
                  Needs{" "}
                  <strong>
                    {selectedGroup.requiredPower} of{" "}
                    {selectedGroup.members.size} signatures
                  </strong>
                  {selectedPermission.canSubmit
                    ? "; yours counts as the first."
                    : "."}
                </>
              )}
              {isAuthenticated &&
                !selectedPermission.canSubmit &&
                selectedPermission.reason && <> {selectedPermission.reason}</>}
            </>
          ) : null}
        </p>
      </section>
      {busy && <p className="muted">Submitting {busy}...</p>}
    </div>
  );
}
