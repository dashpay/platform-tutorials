import { useEffect, useMemo, useRef, useState } from "react";

import { IdentityLabel } from "./IdentityLabel";
import {
  MAX_GROUP_MEMBERS,
  MIN_GROUP_MEMBERS,
  type ReassignableRuleKind,
} from "../dash/contract";
import { groupDisplay, ruleCategory } from "../dash/groupDisplay";
import {
  appendTokenOpsGroup,
  fetchTokenOpsGovernance,
  type RuleAuthority,
  type RuleInfo,
  type TokenOpsGroupInfo,
} from "../dash/governance";
import { errorMessage } from "../dash/logger";
import { CapabilityIcon } from "../lib/capabilityIcon";
import { shortId } from "../lib/format";
import { assignTokenFunctionGroup } from "../dash/tokenOperations";
import { useDpnsNames } from "../hooks/useDpnsNames";
import { useSession } from "../session/useSession";

const REASSIGNABLE = new Set<string>([
  "manualMinting",
  "manualBurning",
  "freeze",
  "unfreeze",
  "destroyFrozenFunds",
  "emergencyAction",
]);

const CATEGORY_ORDER = ["Treasury", "Access", "Emergency", "Config"];

const SHORT_CAPABILITY_LABEL: Record<string, string> = {
  manualMinting: "Mint",
  manualBurning: "Burn",
  freeze: "Freeze",
  unfreeze: "Unfreeze",
  destroyFrozenFunds: "Destroy frozen",
  emergencyAction: "Pause/resume",
};

/** Parses the append-group members textarea into a list of identity IDs. */
function parseMemberIds(raw: string): string[] {
  return raw.split(/[\s,]+/).filter(Boolean);
}

/** Short capability labels a group governs, or "Unused" when none. */
function governsSummary(capabilities: RuleInfo[]): string {
  if (capabilities.length === 0) return "Unused";
  return capabilities
    .map((rule) => SHORT_CAPABILITY_LABEL[rule.key] ?? rule.label)
    .join(" · ");
}

type GovernanceSubView = "access" | "groups";
type GroupFilter = "all" | "mine" | "unused";
type GroupSort = "position" | "members" | "threshold" | "capabilities";

function sortedAuthorityRules(rules: RuleInfo[]): RuleInfo[] {
  return [...rules].sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(ruleCategory(a.key).label) -
      CATEGORY_ORDER.indexOf(ruleCategory(b.key).label),
  );
}

function authorityLabel(authority: RuleAuthority): string {
  switch (authority.type) {
    case "Group":
      return `Group ${authority.groupPosition ?? "?"}`;
    case "ContractOwner":
      return "Contract owner";
    case "NoOne":
      return "No one";
    case "Identity":
      return `Identity ${shortId(authority.identityId)}`;
    case "MainGroup":
      return "Main group";
    default:
      return "Unknown";
  }
}

function authorityMeta(
  authority: RuleAuthority,
  groups: TokenOpsGroupInfo[],
  format: "compact" | "full" = "compact",
): string | null {
  if (authority.type !== "Group") return null;
  const group = groups.find(
    (candidate) => candidate.groupPosition === authority.groupPosition,
  );
  if (!group) return null;
  if (format === "full") {
    return `${group.requiredPower} of ${group.members.size} signatures`;
  }
  return `${group.requiredPower}/${group.members.size} sig`;
}

function authorityGroup(
  authority: RuleAuthority,
  groups: TokenOpsGroupInfo[],
): TokenOpsGroupInfo | undefined {
  if (authority.type !== "Group") return undefined;
  return groups.find(
    (candidate) => candidate.groupPosition === authority.groupPosition,
  );
}

function identityMonogram(id: string): string {
  const alphanumeric = id.replace(/[^a-z0-9]/gi, "");
  return (alphanumeric.slice(0, 2) || "??").toUpperCase();
}

export function GovernanceView() {
  const session = useSession();
  const [groups, setGroups] = useState<TokenOpsGroupInfo[]>([]);
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [contractOwnerId, setContractOwnerId] = useState<string | null>(null);
  const [groupChoice, setGroupChoice] = useState<Record<string, string>>({});
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [newMembers, setNewMembers] = useState("");
  const [newRequiredPower, setNewRequiredPower] = useState("2");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyRuleKey, setBusyRuleKey] = useState<string | null>(null);
  // State drives the disabled/loading UI; the ref is the real mutex so two
  // submits that land before the next render cannot both pass the guard.
  const [appendingGroup, setAppendingGroup] = useState(false);
  const appendInFlightRef = useRef(false);
  const [activeView, setActiveView] = useState<GovernanceSubView>("access");
  const [groupSearch, setGroupSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [groupSort, setGroupSort] = useState<GroupSort>("position");
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [highlightedRule, setHighlightedRule] = useState<string | null>(null);
  const accessRowRefs = useRef(new Map<string, HTMLElement>());

  async function refresh() {
    if (!session.sdk || !session.contractId) return;
    setError(null);
    setRefreshing(true);
    try {
      const governance = await fetchTokenOpsGovernance({
        sdk: session.sdk,
        contractId: session.contractId,
      });
      setGroups(governance.groups);
      setRules(governance.rules);
      setContractOwnerId(governance.contractOwnerId);
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

  useEffect(() => {
    if (!editingRule) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setGroupChoice((prev) => {
        const next = { ...prev };
        delete next[editingRule];
        return next;
      });
      setEditingRule(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingRule]);

  useEffect(() => {
    if (!highlightedRule || activeView !== "access") return;
    const frame = window.requestAnimationFrame(() => {
      accessRowRefs.current
        .get(highlightedRule)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timer = window.setTimeout(() => setHighlightedRule(null), 1800);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [activeView, highlightedRule]);

  async function handleConfirmReassign(
    ruleKind: ReassignableRuleKind,
    groupPosition: number,
  ) {
    if (!session.sdk || !session.keyManager || !session.contractId) return;
    const ownerId = session.identityId;
    if (!ownerId) return;
    const rule = rules.find((candidate) => candidate.key === ruleKind);
    if (!rule || !hasAuthority(rule.admin)) {
      setError(
        "This identity does not have admin authority to reassign this capability.",
      );
      return;
    }
    setBusyRuleKey(ruleKind);
    try {
      await assignTokenFunctionGroup({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: session.contractId,
        ownerId,
        ruleKind,
        groupPosition,
        log: session.log,
      });
      setEditingRule(null);
      setGroupChoice((prev) => {
        const next = { ...prev };
        delete next[ruleKind];
        return next;
      });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyRuleKey(null);
    }
  }

  async function handleAppendGroup(event: React.FormEvent) {
    event.preventDefault();
    if (!session.sdk || !session.keyManager || !session.contractId) return;
    if (!canAppendGroup) {
      setError("Only the contract owner can append an approval group.");
      return;
    }
    // Synchronous mutex before the first await. React state alone is not
    // enough: two submits dispatched before the next render both see
    // appendingGroup === false. Platform groups are immutable, so a
    // duplicate would stick at a new position.
    if (appendInFlightRef.current) return;
    appendInFlightRef.current = true;
    setAppendingGroup(true);
    setError(null);
    try {
      const { identityKey, signer } = await session.keyManager.getAuth();
      await appendTokenOpsGroup({
        sdk: session.sdk,
        contractId: session.contractId,
        memberIds: parseMemberIds(newMembers),
        requiredPower: Number(newRequiredPower),
        identityKey,
        signer,
        log: session.log,
      });
      setNewMembers("");
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      appendInFlightRef.current = false;
      setAppendingGroup(false);
    }
  }

  const appendMemberCount = parseMemberIds(newMembers).length;
  const signedInIdentityId = session.identityId;
  const isAuthenticated = session.status === "authenticated";
  const memberGroups = groups.filter(
    (group) => signedInIdentityId && group.members.has(signedInIdentityId),
  );
  const authorityRules = sortedAuthorityRules(rules);
  const capabilityRules = authorityRules.filter(
    (rule) => ruleCategory(rule.key).label !== "Config",
  );
  const configRules = authorityRules.filter(
    (rule) => ruleCategory(rule.key).label === "Config",
  );
  const memberGroupLabels = memberGroups.map(
    (group) => `Group ${group.groupPosition}`,
  );

  /**
   * Whether the signed-in identity can submit a *direct* admin config update
   * for this authority. Group admins are intentionally false until TokenOps
   * supports the propose → co-sign lifecycle for group-managed config updates
   * (`assignTokenFunctionGroup` has no `groupInfo` / actionId path, and
   * PendingActionsView does not execute configuration proposals).
   */
  function hasAuthority(authority: RuleAuthority): boolean {
    if (!isAuthenticated || !signedInIdentityId) return false;
    switch (authority.type) {
      case "ContractOwner":
        return signedInIdentityId === contractOwnerId;
      case "Identity":
        return signedInIdentityId === authority.identityId;
      case "Group":
        // Group membership alone is not enough for a direct configUpdate —
        // Platform requires a multi-signer group action that this app does
        // not yet implement for reassignment.
        return false;
      default:
        return false;
    }
  }

  function groupAdminSubmissionUnsupported(authority: RuleAuthority): boolean {
    return authority.type === "Group";
  }

  const canAppendGroup =
    isAuthenticated && signedInIdentityId === contractOwnerId;
  const appendFormDisabled = !canAppendGroup || appendingGroup;
  const identityIds = useMemo(
    () => [
      signedInIdentityId,
      ...groups.flatMap((group) => [...group.members.keys()]),
      ...rules

        .map((rule) => [rule.operator.identityId, rule.admin.identityId])
        .flat(),
    ],
    [groups, rules, signedInIdentityId],
  );
  const dpnsNames = useDpnsNames(session.sdk, identityIds);
  const normalizedGroupSearch = groupSearch.trim().toLowerCase();
  const visibleGroups = groups
    .filter((group) => {
      const capabilities = groupDisplay(
        group.groupPosition,
        rules,
      ).capabilities;
      const isMember = Boolean(
        signedInIdentityId && group.members.has(signedInIdentityId),
      );
      if (groupFilter === "mine" && !isMember) return false;
      if (groupFilter === "unused" && capabilities.length > 0) return false;
      if (!normalizedGroupSearch) return true;
      const memberIds = [...group.members.keys()];
      const searchable = [
        `group ${group.groupPosition}`,
        String(group.groupPosition),
        ...memberIds,
        ...memberIds.map((id) => dpnsNames[id]).filter(Boolean),
        ...capabilities.map((rule) => rule.label),
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedGroupSearch);
    })
    .sort((a, b) => {
      const aDisplay = groupDisplay(a.groupPosition, rules);
      const bDisplay = groupDisplay(b.groupPosition, rules);
      switch (groupSort) {
        case "members":
          return b.members.size - a.members.size;
        case "threshold":
          return b.requiredPower - a.requiredPower;
        case "capabilities":
          return bDisplay.capabilities.length - aDisplay.capabilities.length;
        case "position":
        default:
          return a.groupPosition - b.groupPosition;
      }
    });

  // Destination group selected for a rule's inline reassign control. Defaults
  // to the rule's current operator group (or the first group) so the initial
  // selection is a no-op until the user picks a different group.
  function chosenGroupValue(rule: RuleInfo): string {
    const stored = groupChoice[rule.key];
    if (stored !== undefined) return stored;
    if (rule.operator.type === "Group" && rule.operator.groupPosition != null) {
      return String(rule.operator.groupPosition);
    }
    return groups[0] ? String(groups[0].groupPosition) : "";
  }

  function selectGroupForRule(rule: RuleInfo, value: string) {
    setGroupChoice((prev) => ({ ...prev, [rule.key]: value }));
  }

  function closeReassign(ruleKey: string | null = editingRule) {
    if (ruleKey) {
      setGroupChoice((prev) => {
        const next = { ...prev };
        delete next[ruleKey];
        return next;
      });
    }
    setEditingRule(null);
  }

  function openReassign(rule: RuleInfo) {
    setEditingRule(rule.key);
    setGroupChoice((prev) => ({ ...prev, [rule.key]: chosenGroupValue(rule) }));
  }

  function openGroup(groupPosition: number) {
    setActiveView("groups");
    setExpandedGroup(groupPosition);
  }

  function openCapability(ruleKey: string) {
    setActiveView("access");
    setEditingRule(null);
    setHighlightedRule(ruleKey);
  }

  function noOneHint(role: "operator" | "admin"): string {
    if (role === "admin")
      return "Contract does not allow modifying this config item";
    return "Contract does not enable this capability";
  }

  function renderAuthorityButton(
    authority: RuleAuthority,
    role?: "operator" | "admin",
  ) {
    if (authority.type === "Group" && authority.groupPosition != null) {
      return (
        <button
          type="button"
          className="authority-link"
          onClick={() => openGroup(authority.groupPosition ?? 0)}
        >
          {authorityLabel(authority)}
        </button>
      );
    }
    if (authority.type === "NoOne" && role) {
      return (
        <span
          className="authority-value authority-disabled"
          title={noOneHint(role)}
        >
          {authorityLabel(authority)}
        </span>
      );
    }
    if (authority.type === "Identity") {
      return (
        <span className="authority-value authority-identity">
          <span>Identity</span>
          <IdentityLabel
            id={authority.identityId}
            dpnsNames={dpnsNames}
            len={6}
          />
        </span>
      );
    }
    return <span className="authority-value">{authorityLabel(authority)}</span>;
  }

  function renderAccessMatrix(
    rulesToRender: RuleInfo[],
    firstColumnLabel: string,
  ) {
    return (
      <div className="access-matrix">
        <div className="access-matrix-header" aria-hidden="true">
          <span>{firstColumnLabel}</span>
          <span>Operator</span>
          <span>Admin</span>
        </div>
        {rulesToRender.map(renderAccessRow)}
      </div>
    );
  }

  function renderAccessRow(rule: RuleInfo) {
    const category = ruleCategory(rule.key);
    const operatorGroup = authorityGroup(rule.operator, groups);
    const operatorDisplay = operatorGroup
      ? groupDisplay(operatorGroup.groupPosition, rules)
      : null;
    const operatorMeta = authorityMeta(rule.operator, groups);
    const adminMeta = authorityMeta(rule.admin, groups);
    const canReassign = REASSIGNABLE.has(rule.key) && groups.length > 0;
    const isOperatorMember = Boolean(
      signedInIdentityId && operatorGroup?.members.has(signedInIdentityId),
    );
    return (
      <article
        key={rule.key}
        ref={(element) => {
          if (element) {
            accessRowRefs.current.set(rule.key, element);
          } else {
            accessRowRefs.current.delete(rule.key);
          }
        }}
        className={`access-row ${
          highlightedRule === rule.key ? "is-highlighted" : ""
        }`}
      >
        <div className="access-capability">
          <span className="capability-title">
            <CapabilityIcon kind={rule.key} accent={category.accent} />
            <strong>{rule.label}</strong>
          </span>
          <span className={`access-domain ${category.accent}`}>
            {category.label}
          </span>
          {isOperatorMember && <span className="member-badge">Member</span>}
        </div>
        <div className="access-authority">
          <span className="authority-label">Operator</span>
          {operatorDisplay && (
            <span
              className={`authority-group-dot ${operatorDisplay.accent}`}
              aria-hidden="true"
            />
          )}
          {canReassign ? (
            <>
              <span className="authority-assignment">
                {renderAuthorityButton(rule.operator, "operator")}
                {operatorMeta && (
                  <span className="authority-meta">{operatorMeta}</span>
                )}
              </span>
              <button
                type="button"
                className="authority-edit-button"
                onClick={() => openReassign(rule)}
              >
                Edit
              </button>
            </>
          ) : (
            <span className="authority-assignment">
              {renderAuthorityButton(rule.operator, "operator")}
              {operatorMeta && (
                <span className="authority-meta">{operatorMeta}</span>
              )}
            </span>
          )}
        </div>
        <div className="access-authority admin-authority">
          <span className="authority-label">Admin</span>
          {renderAuthorityButton(rule.admin, "admin")}
          {adminMeta && <span className="authority-meta">{adminMeta}</span>}
        </div>
      </article>
    );
  }

  function renderReassignModal() {
    const rule = rules.find((candidate) => candidate.key === editingRule);
    if (!rule) return null;
    const chosen = chosenGroupValue(rule);
    const chosenGroupInfo = groups.find(
      (group) => group.groupPosition === Number(chosen),
    );
    const currentValue =
      rule.operator.type === "Group" && rule.operator.groupPosition != null
        ? String(rule.operator.groupPosition)
        : "";
    const isNoOp = chosen === currentValue;
    const canSubmit = hasAuthority(rule.admin);
    const groupAdminUnsupported = groupAdminSubmissionUnsupported(rule.admin);
    const category = ruleCategory(rule.key);

    return (
      <div className="modal-backdrop" onClick={() => closeReassign(rule.key)}>
        <div
          className="modal-panel reassign-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reassign-modal-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-header">
            <div className="modal-title-row">
              <CapabilityIcon
                kind={rule.key}
                accent={category.accent}
                className="modal-capability-icon"
              />
              <div>
                <h4 id="reassign-modal-title">Reassign operator</h4>
                <p className="muted">{rule.label}</p>
              </div>
            </div>
            <button
              type="button"
              className="modal-close-button"
              aria-label="Close"
              onClick={() => closeReassign(rule.key)}
            >
              ×
            </button>
          </div>
          <div className="reassign-modal-body">
            <div className="reassign-field-grid">
              <span className="authority-label">Current operator</span>
              <strong>{authorityLabel(rule.operator)}</strong>
              {authorityMeta(rule.operator, groups, "full") && (
                <span className="authority-meta">
                  {authorityMeta(rule.operator, groups, "full")}
                </span>
              )}
            </div>
            <label className="field" htmlFor="reassign-operator-group">
              New operator group
              <select
                id="reassign-operator-group"
                value={chosen}
                onChange={(event) =>
                  selectGroupForRule(rule, event.target.value)
                }
              >
                {groups.map((group) => (
                  <option key={group.groupPosition} value={group.groupPosition}>
                    Group {group.groupPosition} · {group.requiredPower} of{" "}
                    {group.members.size} signatures
                  </option>
                ))}
              </select>
            </label>
            {chosenGroupInfo && (
              <p className="reassign-warning">
                {groupAdminUnsupported
                  ? "You can inspect this change, but group-admin reassignment is not supported yet. TokenOps only submits direct config updates for ContractOwner or Identity admins; group-managed reassignment needs a propose and co-sign lifecycle that is not implemented."
                  : !canSubmit
                    ? isAuthenticated
                      ? "You can inspect this change, but this identity does not have the admin authority required to submit it."
                      : "You can inspect this change, but you must sign in with an identity that has admin authority to submit it."
                    : isNoOp
                      ? "Choose a different group to reassign this capability."
                      : `${rule.label} will move from ${authorityLabel(
                          rule.operator,
                        )} to Group ${chosenGroupInfo.groupPosition}. ${
                          rule.operator.type === "Group"
                            ? `Group ${rule.operator.groupPosition} members lose the ability to perform this action.`
                            : ""
                        }`}
              </p>
            )}
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => closeReassign(rule.key)}
              disabled={busyRuleKey === rule.key}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit || isNoOp || busyRuleKey === rule.key}
              onClick={() =>
                void handleConfirmReassign(
                  rule.key as ReassignableRuleKind,
                  Number(chosen),
                )
              }
            >
              {busyRuleKey === rule.key
                ? "Submitting..."
                : "Confirm reassignment"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="governance-screen">
      {error && <div className="notice error">{error}</div>}

      <section className="card">
        <div className="row between">
          <div>
            <h3>Governance</h3>
            <p className="muted">
              Manage token authority assignments and the approval groups behind
              them.
            </p>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {isAuthenticated && (
          <div className="standing-summary">
            <strong>Your standing</strong>
            <span>
              {memberGroups.length === 0
                ? "This identity is not a member of any loaded approval group."
                : `Member of ${memberGroupLabels.join(", ")}.`}
            </span>
            {memberGroups.length > 0 && (
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setActiveView("groups");
                  setGroupFilter("mine");
                }}
              >
                Show my groups
              </button>
            )}
          </div>
        )}
        <div
          className="governance-subnav"
          role="tablist"
          aria-label="Governance views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "access"}
            className={activeView === "access" ? "active" : ""}
            onClick={() => setActiveView("access")}
          >
            Access control
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "groups"}
            className={activeView === "groups" ? "active" : ""}
            onClick={() => setActiveView("groups")}
          >
            Groups
          </button>
        </div>

        {activeView === "access" ? (
          <div className="governance-pane" role="tabpanel">
            <div className="access-section">
              <h4>Capability authority</h4>
              <p className="muted">Who can perform token actions.</p>
              {renderAccessMatrix(capabilityRules, "Capability")}
            </div>
            <div className="access-section">
              <h4>Config authority</h4>
              <p className="muted">Who controls token settings.</p>
              {renderAccessMatrix(configRules, "Setting")}
            </div>
          </div>
        ) : (
          <div className="governance-pane" role="tabpanel">
            <div className="group-list-head">
              <div>
                <h4>Groups</h4>
                <p className="muted">
                  Search, filter, and inspect append-only approval bodies.
                </p>
              </div>
              <div className="group-tools">
                <label className="field compact" htmlFor="group-search">
                  Search
                  <input
                    id="group-search"
                    value={groupSearch}
                    onChange={(event) => setGroupSearch(event.target.value)}
                    placeholder="Group, member, capability"
                  />
                </label>
                <label className="field compact" htmlFor="group-filter">
                  Filter
                  <select
                    id="group-filter"
                    value={groupFilter}
                    onChange={(event) =>
                      setGroupFilter(event.target.value as GroupFilter)
                    }
                  >
                    <option value="all">All groups</option>
                    <option value="mine">Groups I'm in</option>
                    <option value="unused">Unused / empty</option>
                  </select>
                </label>
                <label className="field compact" htmlFor="group-sort">
                  Sort
                  <select
                    id="group-sort"
                    value={groupSort}
                    onChange={(event) =>
                      setGroupSort(event.target.value as GroupSort)
                    }
                  >
                    <option value="position">Position</option>
                    <option value="members">Members</option>
                    <option value="threshold">Threshold</option>
                    <option value="capabilities">Capabilities</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="group-table">
              {visibleGroups.map((group) => {
                const display = groupDisplay(group.groupPosition, rules);
                const isMember = Boolean(
                  signedInIdentityId && group.members.has(signedInIdentityId),
                );
                const isExpanded = expandedGroup === group.groupPosition;
                return (
                  <article
                    key={group.groupPosition}
                    className="group-table-row"
                  >
                    <button
                      type="button"
                      className="group-row-main"
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpandedGroup(
                          isExpanded ? null : group.groupPosition,
                        )
                      }
                    >
                      <span
                        className={`group-mark ${display.accent}`}
                        aria-hidden="true"
                      />
                      <span className="group-row-identity">
                        <strong>Group {group.groupPosition}</strong>
                        <span className="muted">
                          {group.members.size} members · needs{" "}
                          {group.requiredPower}{" "}
                          {group.requiredPower === 1
                            ? "signature"
                            : "signatures"}
                        </span>
                      </span>
                      <span className="group-row-governs">
                        <span className="group-row-governs-label">Governs</span>
                        <span
                          className={`group-row-governs-value ${
                            display.capabilities.length === 0 ? "unused" : ""
                          }`}
                        >
                          {governsSummary(display.capabilities)}
                        </span>
                      </span>
                      {isMember && <span className="member-badge">Member</span>}
                    </button>
                    {isExpanded && (
                      <div className="group-detail-panel">
                        <div>
                          <h5>Members</h5>
                          <div className="member-list">
                            {[...group.members.keys()].map((id) => (
                              <div key={id} className="member-row">
                                <span
                                  className={`identity-mark ${display.accent}`}
                                  aria-hidden="true"
                                >
                                  {identityMonogram(dpnsNames[id] ?? id)}
                                </span>
                                <IdentityLabel id={id} dpnsNames={dpnsNames} />
                                {id === signedInIdentityId && (
                                  <span className="you-badge">You</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h5>Assigned capabilities</h5>
                          {display.capabilities.length === 0 ? (
                            <p className="empty-group-note">
                              Members can't perform any governed action yet.
                            </p>
                          ) : (
                            <div className="capability-link-list">
                              {display.capabilities.map((rule) => (
                                <button
                                  type="button"
                                  key={rule.key}
                                  className="capability-link-row"
                                  onClick={() => openCapability(rule.key)}
                                >
                                  <CapabilityIcon
                                    kind={rule.key}
                                    accent={ruleCategory(rule.key).accent}
                                    className="capability-link-icon"
                                  />
                                  <span className="capability-link-label">
                                    {rule.label}
                                  </span>
                                  <span className="capability-link-action">
                                    ↗
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            {visibleGroups.length === 0 && (
              <p className="empty-group-note">
                No groups match the current search and filters.
              </p>
            )}
            {isAuthenticated && (
              <div className="append-group-section">
                <h4>Append approval group</h4>
                <p className="muted">
                  Existing groups are immutable. To change membership, append a
                  successor group and reassign the relevant capabilities to it.
                </p>
                {!canAppendGroup && (
                  <p className="notice">
                    You can inspect this form, but only the contract owner can
                    append an approval group.
                  </p>
                )}
                <form onSubmit={handleAppendGroup}>
                  <div className="field">
                    <label htmlFor="new-members">Member identity IDs</label>
                    <textarea
                      id="new-members"
                      rows={2}
                      value={newMembers}
                      disabled={appendFormDisabled}
                      onChange={(e) => setNewMembers(e.target.value)}
                      placeholder="comma or space separated"
                    />
                    <p className="muted">
                      {MIN_GROUP_MEMBERS}–{MAX_GROUP_MEMBERS} distinct
                      identities.
                    </p>
                  </div>
                  <div className="field">
                    <label htmlFor="required-power">Required power</label>
                    <input
                      id="required-power"
                      type="number"
                      min={1}
                      max={appendMemberCount || undefined}
                      value={newRequiredPower}
                      disabled={appendFormDisabled}
                      onChange={(e) => setNewRequiredPower(e.target.value)}
                    />
                    <p className="muted">
                      Signatures needed to act (1–
                      {appendMemberCount || MIN_GROUP_MEMBERS}).
                    </p>
                  </div>
                  <button type="submit" disabled={appendFormDisabled}>
                    {appendingGroup ? "Appending..." : "Append group"}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </section>
      {renderReassignModal()}
    </div>
  );
}
