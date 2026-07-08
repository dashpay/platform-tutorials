import { useEffect, useState } from "react";

import { CopyableId } from "./CopyableId";
import { type ReassignableRuleKind } from "../dash/contract";
import {
  appendTokenOpsGroup,
  fetchTokenOpsGovernance,
  type RuleAuthority,
  type RuleInfo,
  type TokenOpsGroupInfo,
} from "../dash/governance";
import { errorMessage } from "../dash/logger";
import { shortId } from "../lib/format";
import { assignTokenFunctionGroup } from "../dash/tokenOperations";
import { useSession } from "../session/useSession";

const REASSIGNABLE = new Set<string>([
  "manualMinting",
  "manualBurning",
  "freeze",
  "unfreeze",
  "destroyFrozenFunds",
  "emergencyAction",
]);

interface Category {
  label: string;
  accent: string;
}

/**
 * Capability categories. The label strings reuse the seed group names
 * (Treasury / Access / Emergency) but describe the capability *domain* — they
 * are intrinsic to the rule, not to any group position. A group earns a
 * "Treasury" tag because it currently controls a Treasury-domain capability,
 * wherever it sits, so the tags stay correct after any reassignment.
 */
const CATEGORY_BY_RULE_KEY: Record<string, Category> = {
  manualMinting: { label: "Treasury", accent: "green" },
  manualBurning: { label: "Treasury", accent: "green" },
  freeze: { label: "Access", accent: "orange" },
  unfreeze: { label: "Access", accent: "orange" },
  destroyFrozenFunds: { label: "Access", accent: "orange" },
  emergencyAction: { label: "Emergency", accent: "purple" },
};

const CONFIG_CATEGORY: Category = { label: "Config", accent: "blue" };

const CATEGORY_DESCRIPTION: Record<string, string> = {
  Treasury: "Minting and burning token supply.",
  Access: "Freezing, unfreezing, and destroying frozen balances.",
  Emergency: "Pausing and resuming the token.",
  Config: "Token settings, shown for reference.",
};

function ruleCategory(ruleKey: string): Category {
  return CATEGORY_BY_RULE_KEY[ruleKey] ?? CONFIG_CATEGORY;
}

/**
 * Capability glyphs. Same icon vocabulary as PendingActionsView's actionIcon,
 * keyed here by rule key so the Governance and Pending views stay visually
 * consistent.
 */
const RULE_ICON: Record<string, string> = {
  manualMinting: "↑",
  manualBurning: "↓",
  freeze: "∗",
  unfreeze: "✓",
  destroyFrozenFunds: "!",
  emergencyAction: "!",
};

function ruleIcon(ruleKey: string): string {
  return RULE_ICON[ruleKey] ?? "•";
}

const CATEGORY_ORDER = ["Treasury", "Access", "Emergency", "Config"];

interface CategorySection {
  category: Category;
  rules: RuleInfo[];
}

/** Partition rules into category sections in a stable display order. */
function categorySections(rules: RuleInfo[]): CategorySection[] {
  const byLabel = new Map<string, CategorySection>();
  for (const rule of rules) {
    const category = ruleCategory(rule.key);
    const section = byLabel.get(category.label);
    if (section) {
      section.rules.push(rule);
    } else {
      byLabel.set(category.label, { category, rules: [rule] });
    }
  }
  return [...byLabel.values()].sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category.label) -
      CATEGORY_ORDER.indexOf(b.category.label),
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
): string | null {
  if (authority.type !== "Group") return null;
  const group = groups.find(
    (candidate) => candidate.groupPosition === authority.groupPosition,
  );
  if (!group) return null;
  return `${group.requiredPower} of ${group.members.size} signatures`;
}

/**
 * The distinct capability categories a group currently has *operator*
 * authority over, derived live from the rules so the tags follow reassignment.
 */
function groupCategories(groupPosition: number, rules: RuleInfo[]): Category[] {
  const seen = new Set<string>();
  const categories: Category[] = [];
  for (const rule of rules) {
    if (
      rule.operator.type !== "Group" ||
      rule.operator.groupPosition !== groupPosition
    ) {
      continue;
    }
    const category = ruleCategory(rule.key);
    if (seen.has(category.label)) continue;
    seen.add(category.label);
    categories.push(category);
  }
  return categories;
}

function identityMonogram(id: string): string {
  const alphanumeric = id.replace(/[^a-z0-9]/gi, "");
  return (alphanumeric.slice(0, 2) || "??").toUpperCase();
}

export function GovernanceView() {
  const session = useSession();
  const [groups, setGroups] = useState<TokenOpsGroupInfo[]>([]);
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [groupChoice, setGroupChoice] = useState<Record<string, string>>({});
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [confirmingRule, setConfirmingRule] = useState<string | null>(null);
  const [newMembers, setNewMembers] = useState("");
  const [newRequiredPower, setNewRequiredPower] = useState("2");
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
      setGroups(governance.groups);
      setRules(governance.rules);
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

  async function handleConfirmReassign(
    ruleKind: ReassignableRuleKind,
    groupPosition: number,
  ) {
    if (!session.sdk || !session.keyManager || !session.contractId) return;
    const ownerId = session.identityId;
    if (!ownerId) return;
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
      setConfirmingRule(null);
      setEditingRule(null);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleAppendGroup(event: React.FormEvent) {
    event.preventDefault();
    if (!session.sdk || !session.keyManager || !session.contractId) return;
    try {
      const { identityKey, signer } = await session.keyManager.getAuth();
      await appendTokenOpsGroup({
        sdk: session.sdk,
        contractId: session.contractId,
        memberIds: newMembers.split(/[\s,]+/).filter(Boolean),
        requiredPower: Number(newRequiredPower),
        identityKey,
        signer,
        log: session.log,
      });
      setNewMembers("");
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const signedInIdentityId = session.identityId;
  const isAuthenticated = session.status === "authenticated";

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

  function selectGroupForRule(ruleKey: string, value: string) {
    setGroupChoice((prev) => ({ ...prev, [ruleKey]: value }));
    if (confirmingRule === ruleKey) setConfirmingRule(null);
  }

  function openReassign(ruleKey: string) {
    setEditingRule(ruleKey);
    setConfirmingRule(null);
  }

  function closeReassign() {
    setEditingRule(null);
    setConfirmingRule(null);
  }

  return (
    <div className="governance-screen">
      {error && <div className="notice error">{error}</div>}

      <section className="card">
        <div className="row between">
          <div>
            <h3>Groups</h3>
            <p className="muted">
              Approval groups control who can submit or co-sign governed token
              operations. Tags show which capabilities each group currently
              controls.
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
        <div className="group-grid">
          {groups.map((group) => {
            const categories = groupCategories(group.groupPosition, rules);
            const accent = categories[0]?.accent ?? "blue";
            return (
              <div key={group.groupPosition} className="group-card">
                <div className="group-card-header">
                  <div className="group-title-row">
                    <span
                      className={`group-mark ${accent}`}
                      aria-hidden="true"
                    />
                    <div>
                      <strong>Group {group.groupPosition}</strong>
                      <span className="muted">
                        {group.members.size} members
                      </span>
                    </div>
                  </div>
                  <span className="threshold-badge">
                    {group.requiredPower} of {group.members.size} required
                  </span>
                </div>
                <div className="category-tag-row">
                  {categories.length > 0 ? (
                    categories.map((category) => (
                      <span
                        key={category.label}
                        className={`category-tag ${category.accent}`}
                      >
                        {category.label}
                      </span>
                    ))
                  ) : (
                    <span className="muted">No assigned capabilities</span>
                  )}
                </div>
                <p className="threshold-text">
                  Threshold: {group.requiredPower} of {group.members.size}{" "}
                  signers
                </p>
                <hr className="group-divider" />
                <span className="member-heading">
                  Members ({group.members.size})
                </span>
                <div className="member-list">
                  {[...group.members.keys()].map((id) => (
                    <div key={id} className="member-row">
                      <span
                        className={`identity-mark ${accent}`}
                        aria-hidden="true"
                      >
                        {identityMonogram(id)}
                      </span>
                      <CopyableId id={id} />
                      {id === signedInIdentityId && (
                        <span className="you-badge">You</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h3>Capabilities</h3>
        <p className="muted">
          Capabilities are grouped by domain. Each lists who can perform the
          action and who can reassign that authority.
        </p>
        {categorySections(rules).map((section) => (
          <div key={section.category.label} className="capability-category">
            <div className="capability-category-head">
              <h4>{section.category.label}</h4>
              {CATEGORY_DESCRIPTION[section.category.label] && (
                <p className="muted">
                  {CATEGORY_DESCRIPTION[section.category.label]}
                </p>
              )}
            </div>
            <div className="capability-grid">
              {section.rules.map((rule) => {
                const operatorMeta = authorityMeta(rule.operator, groups);
                const adminMeta = authorityMeta(rule.admin, groups);
                const canReassign =
                  isAuthenticated &&
                  REASSIGNABLE.has(rule.key) &&
                  groups.length > 0;
                const chosen = chosenGroupValue(rule);
                const isNoOp =
                  rule.operator.type === "Group" &&
                  rule.operator.groupPosition === Number(chosen);
                const editing = editingRule === rule.key;
                const confirming = confirmingRule === rule.key;
                const chosenGroupInfo = groups.find(
                  (group) => group.groupPosition === Number(chosen),
                );
                return (
                  <article key={rule.key} className="capability-card">
                    <div className="capability-head">
                      <span className="capability-title">
                        <span
                          className={`capability-icon ${section.category.accent}`}
                          aria-hidden="true"
                        >
                          {ruleIcon(rule.key)}
                        </span>
                        <strong>{rule.label}</strong>
                      </span>
                      {rule.deferred && (
                        <span className="capability-flag">Display only</span>
                      )}
                    </div>
                    <div className="authority-row">
                      <div className="authority-panel">
                        <span className="authority-label">Who can act</span>
                        {canReassign ? (
                          <button
                            type="button"
                            className="authority-value authority-trigger"
                            aria-expanded={editing}
                            onClick={() =>
                              editing
                                ? closeReassign()
                                : openReassign(rule.key)
                            }
                          >
                            {authorityLabel(rule.operator)}
                          </button>
                        ) : (
                          <span className="authority-value">
                            {authorityLabel(rule.operator)}
                          </span>
                        )}
                        {operatorMeta && (
                          <span className="authority-meta">{operatorMeta}</span>
                        )}
                      </div>
                      <div className="authority-panel">
                        <span className="authority-label">Who can reassign</span>
                        <span className="authority-value">
                          {authorityLabel(rule.admin)}
                        </span>
                        {adminMeta && (
                          <span className="authority-meta">{adminMeta}</span>
                        )}
                      </div>
                    </div>

                    {canReassign && editing && (
                      <div className="capability-reassign">
                        {!confirming && (
                          <>
                            <div className="capability-reassign-controls">
                              <label
                                className="reassign-inline-label"
                                htmlFor={`reassign-${rule.key}`}
                              >
                                Move to
                              </label>
                              <select
                                id={`reassign-${rule.key}`}
                                value={chosen}
                                onChange={(e) =>
                                  selectGroupForRule(rule.key, e.target.value)
                                }
                              >
                                {groups.map((group) => (
                                  <option
                                    key={group.groupPosition}
                                    value={group.groupPosition}
                                  >
                                    Group {group.groupPosition}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {groupChoice[rule.key] !== undefined && isNoOp && (
                              <p className="capability-footer muted">
                                Already assigned to this group.
                              </p>
                            )}
                            <div className="reassign-actions">
                              <button
                                type="button"
                                className="secondary"
                                onClick={closeReassign}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={isNoOp}
                                onClick={() => setConfirmingRule(rule.key)}
                              >
                                Review change
                              </button>
                            </div>
                          </>
                        )}

                        {confirming && chosenGroupInfo && (
                          <>
                            <div className="reassign-preview">
                              <div className="reassign-flow">
                                <span className="reassign-from">
                                  {authorityLabel(rule.operator)}
                                </span>
                                <span
                                  className="reassign-arrow"
                                  aria-hidden="true"
                                >
                                  →
                                </span>
                                <span className="reassign-to">
                                  Group {chosenGroupInfo.groupPosition}
                                </span>
                              </div>
                              <p className="reassign-warning">
                                {rule.label} will move from{" "}
                                {authorityLabel(rule.operator)} to Group{" "}
                                {chosenGroupInfo.groupPosition}.{" "}
                                {rule.operator.type === "Group" &&
                                  `Group ${rule.operator.groupPosition} members lose the ability to perform this action.`}
                              </p>
                            </div>
                            <div className="reassign-actions">
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => setConfirmingRule(null)}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleConfirmReassign(
                                    rule.key as ReassignableRuleKind,
                                    Number(chosen),
                                  )
                                }
                              >
                                Confirm reassignment
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {!canReassign && (
                      <p className="capability-footer muted">
                        {rule.supportsGroupAction
                          ? "Reassignable to a group."
                          : "Not group-reassignable."}
                        {rule.canSetOperatorToNoOne &&
                          " Operator can be set to No one."}
                        {rule.canSetAdminToNoOne && " Admin can be set to No one."}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {session.status === "authenticated" && (
        <section className="card governance-advanced">
          <h3>Append approval group</h3>
          <p className="muted">
            Existing groups are immutable. To change membership, append a new
            group and reassign the relevant capabilities to it.
          </p>
          <form onSubmit={handleAppendGroup}>
            <div className="field">
              <label htmlFor="new-members">Three member identity IDs</label>
              <textarea
                id="new-members"
                rows={2}
                value={newMembers}
                onChange={(e) => setNewMembers(e.target.value)}
                placeholder="comma or space separated"
              />
            </div>
            <div className="field">
              <label htmlFor="required-power">Required power</label>
              <input
                id="required-power"
                type="number"
                min={1}
                max={3}
                value={newRequiredPower}
                onChange={(e) => setNewRequiredPower(e.target.value)}
              />
            </div>
            <button type="submit">Append group</button>
          </form>
        </section>
      )}
    </div>
  );
}
