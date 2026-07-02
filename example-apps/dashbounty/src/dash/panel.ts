/**
 * Read the Triage Panel's current composition.
 *
 * `sdk.group.info` returns the Group as published in the contract (members
 * map + requiredPower). `isPanelMember` checks membership against that
 * fetched map directly rather than issuing a second query via
 * `sdk.group.identityGroups` — cheaper, and this app only ever needs to
 * check membership in the one group it defines.
 *
 * SDK methods: sdk.group.info(...), sdk.group.members(...)
 */
import { PANEL_GROUP_POSITION, PANEL_REQUIRED_POWER } from "./contract";
import type { Logger } from "./logger";
import type { DashSdk } from "./types";

export interface PanelInfo {
  members: Map<string, number>;
  requiredPower: number;
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
  const group = await sdk.group.info(contractId, PANEL_GROUP_POSITION);
  if (!group) {
    log?.("Triage panel not found on this contract.", "error");
    return { members: new Map(), requiredPower: PANEL_REQUIRED_POWER };
  }
  return { members: group.members, requiredPower: group.requiredPower };
}

export async function fetchPanelMembers({
  sdk,
  contractId,
  log,
}: {
  sdk: DashSdk;
  contractId: string;
  log?: Logger;
}): Promise<string[]> {
  const members = await sdk.group.members({
    dataContractId: contractId,
    groupContractPosition: PANEL_GROUP_POSITION,
  });
  const ids = [...members.keys()];
  log?.(`Triage panel has ${ids.length} member(s).`);
  return ids;
}

export function isPanelMember(panel: PanelInfo, identityId: string): boolean {
  return panel.members.has(identityId);
}
