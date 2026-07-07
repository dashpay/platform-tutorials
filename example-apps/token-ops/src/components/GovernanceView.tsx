import { useEffect, useState } from "react";

import { CopyableId } from "./CopyableId";
import { type ReassignableRuleKind } from "../dash/contract";
import {
  appendTokenOpsGroup,
  fetchTokenOpsGovernance,
  formatAuthority,
  type RuleInfo,
  type TokenOpsGroupInfo,
} from "../dash/governance";
import { errorMessage } from "../dash/logger";
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

export function GovernanceView() {
  const session = useSession();
  const [groups, setGroups] = useState<TokenOpsGroupInfo[]>([]);
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [selectedRule, setSelectedRule] =
    useState<ReassignableRuleKind>("manualMinting");
  const [selectedGroup, setSelectedGroup] = useState("0");
  const [newMembers, setNewMembers] = useState("");
  const [newRequiredPower, setNewRequiredPower] = useState("2");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!session.sdk || !session.contractId) return;
    setError(null);
    try {
      const governance = await fetchTokenOpsGovernance({
        sdk: session.sdk,
        contractId: session.contractId,
      });
      setGroups(governance.groups);
      setRules(governance.rules);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sdk, session.contractId]);

  async function handleAssign(event: React.FormEvent) {
    event.preventDefault();
    if (!session.sdk || !session.keyManager || !session.contractId) return;
    const ownerId = session.identityId;
    if (!ownerId) return;
    try {
      await assignTokenFunctionGroup({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: session.contractId,
        ownerId,
        ruleKind: selectedRule,
        groupPosition: Number(selectedGroup),
        log: session.log,
      });
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

  return (
    <div>
      {error && <div className="notice error">{error}</div>}
      <div className="card">
        <div className="row between">
          <h3>Groups</h3>
          <button type="button" className="secondary" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
        <div className="list">
          {groups.map((group) => (
            <div key={group.groupPosition} className="card">
              <div className="row between">
                <strong>Group {group.groupPosition}</strong>
                <span className="muted">
                  {group.requiredPower}/{group.members.size} required
                </span>
              </div>
              {[...group.members.keys()].map((id) => (
                <p key={id}>
                  <CopyableId id={id} len={8} />
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>

      {session.status === "authenticated" && (
        <div className="card">
          <h3>Append group</h3>
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
        </div>
      )}

      <div className="card">
        <h3>ChangeControlRules</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Capability</th>
                <th>Operator</th>
                <th>Admin</th>
                <th>{"Operator -> NoOne"}</th>
                <th>{"Admin -> NoOne"}</th>
                <th>Group action</th>
                <th>Config item</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.key}>
                  <td>{rule.label}</td>
                  <td>{formatAuthority(rule.operator)}</td>
                  <td>{formatAuthority(rule.admin)}</td>
                  <td>{rule.canSetOperatorToNoOne ? "Yes" : "No"}</td>
                  <td>{rule.canSetAdminToNoOne ? "Yes" : "No"}</td>
                  <td>{rule.supportsGroupAction ? "Yes" : "No"}</td>
                  <td>
                    {rule.configUpdateItem ?? "Display only"}
                    {rule.deferred && " (deferred)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {session.status === "authenticated" && (
        <div className="card">
          <h3>Reassign operator authority</h3>
          <form className="row wrap" onSubmit={handleAssign}>
            <select
              aria-label="Rule"
              value={selectedRule}
              onChange={(e) =>
                setSelectedRule(e.target.value as ReassignableRuleKind)
              }
            >
              {rules
                .filter((rule) => REASSIGNABLE.has(rule.key))
                .map((rule) => (
                  <option key={rule.key} value={rule.key}>
                    {rule.label}
                  </option>
                ))}
            </select>
            <select
              aria-label="Group"
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              {groups.map((group) => (
                <option key={group.groupPosition} value={group.groupPosition}>
                  Group {group.groupPosition}
                </option>
              ))}
            </select>
            <button type="submit">Assign</button>
          </form>
        </div>
      )}
    </div>
  );
}
