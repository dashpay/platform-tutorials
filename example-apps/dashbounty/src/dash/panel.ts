/**
 * Read the Triage Panel's current composition.
 *
 * "Current" is dynamic: the acting panel is whichever group the token's
 * `mainControlGroup` points at — group 0 at launch, a higher appended
 * position after a roster rotation (see rotatePanelRoster.ts).
 * `fetchActivePanelPosition` resolves that position from the published
 * token configuration; every other helper here (and the
 * freeze/unfreeze/destroy/groupActions callers) takes the resolved position
 * rather than assuming the founding group 0.
 *
 * `sdk.group.info` returns the Group as published in the contract (members
 * map + requiredPower). `isPanelMember` checks membership against that
 * fetched map directly rather than issuing a second query via
 * `sdk.group.identityGroups` — cheaper, and this app only ever needs to
 * check membership in the one active group.
 *
 * SDK methods: sdk.contracts.fetch(...), sdk.group.info(...),
 * sdk.group.members(...)
 */
import { PANEL_GROUP_POSITION, PANEL_REQUIRED_POWER } from "./contract";
import type { Logger } from "./logger";
import { RESEARCHER_CREDIT_POSITION } from "./researcherCredit";
import type { DashSdk } from "./types";

export interface PanelInfo {
  /** The active main-control-group position this info was read from. */
  groupPosition: number;
  members: Map<string, number>;
  requiredPower: number;
}

/**
 * Resolve which group position currently governs the Researcher Credit —
 * i.e. the token's `mainControlGroup`. Falls back to the founding
 * PANEL_GROUP_POSITION if the config doesn't expose one.
 */
export async function fetchActivePanelPosition({
  sdk,
  contractId,
}: {
  sdk: DashSdk;
  contractId: string;
}): Promise<number> {
  const contract = await sdk.contracts.fetch(contractId);
  return (
    contract?.tokens?.[RESEARCHER_CREDIT_POSITION]?.mainControlGroup ??
    PANEL_GROUP_POSITION
  );
}

export async function fetchPanelInfo({
  sdk,
  contractId,
  log,
}: {
  sdk: DashSdk;
  contractId: string;
  log?: Logger;
}): Promise<PanelInfo> {
  const groupPosition = await fetchActivePanelPosition({ sdk, contractId });
  const group = await sdk.group.info(contractId, groupPosition);
  if (!group) {
    log?.("Triage panel not found on this contract.", "error");
    return {
      groupPosition,
      members: new Map(),
      requiredPower: PANEL_REQUIRED_POWER,
    };
  }
  return {
    groupPosition,
    members: group.members,
    requiredPower: group.requiredPower,
  };
}

export async function fetchPanelMembers({
  sdk,
  contractId,
  groupPosition,
  log,
}: {
  sdk: DashSdk;
  contractId: string;
  /** Active group position; resolved from the token config when omitted. */
  groupPosition?: number;
  log?: Logger;
}): Promise<string[]> {
  const position =
    groupPosition ?? (await fetchActivePanelPosition({ sdk, contractId }));
  const members = await sdk.group.members({
    dataContractId: contractId,
    groupContractPosition: position,
  });
  const ids = [...members.keys()];
  log?.(`Triage panel has ${ids.length} member(s).`);
  return ids;
}

export function isPanelMember(panel: PanelInfo, identityId: string): boolean {
  return panel.members.has(identityId);
}
