/**
 * Add or remove a Triage Panel member.
 *
 * There is no dedicated "update group members" state transition — Platform
 * doesn't expose one. Panel roster changes are an ordinary contract update:
 * fetch the contract, mutate `dataContract.groups[0].members` (a Map), bump
 * `dataContract.version`, and call `sdk.contracts.update(...)`. This is
 * directly modeled on `2-Contracts-and-Documents/contract-update-minimal.mjs`,
 * substituting a `.groups` mutation for that tutorial's `.schemas` mutation.
 *
 * `DataContractConfig` has no ChangeControlRules-style admin gate of its
 * own, so `sdk.contracts.update(...)` is unconditionally owner-key-
 * authorized — there is no way to make roster rotation itself require
 * 2-of-3 panel approval. This is a deliberate, verified design conclusion:
 * the bounty program *operator* administers who's on the panel, the panel
 * doesn't self-govern its own membership. The caller must sign with the
 * contract owner's key; anyone else's call will be rejected on-chain.
 *
 * Fetches fresh immediately before mutating so two racing roster edits
 * don't collide on a stale `.version`.
 *
 * SDK methods: sdk.contracts.fetch(...), sdk.contracts.update(...)
 */
import { Group } from "@dashevo/evo-sdk";

import { PANEL_GROUP_POSITION, PANEL_REQUIRED_POWER } from "./contract";
import { errorMessage, type Logger } from "./logger";
import type { DashKeyManager, DashSdk } from "./types";

export async function updatePanelRoster({
  sdk,
  keyManager,
  contractId,
  addMemberId,
  removeMemberId,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  addMemberId?: string;
  removeMemberId?: string;
  log?: Logger;
}): Promise<void> {
  if (!addMemberId && !removeMemberId) {
    throw new Error("Provide addMemberId and/or removeMemberId.");
  }

  try {
    const { identityKey, signer } = await keyManager.getAuth();

    const existingContract = await sdk.contracts.fetch(contractId);
    if (!existingContract) throw new Error(`Contract ${contractId} not found.`);

    const currentGroup = existingContract.groups?.[PANEL_GROUP_POSITION];
    if (!currentGroup) {
      throw new Error(
        `Contract ${contractId} has no group at position ${PANEL_GROUP_POSITION}.`,
      );
    }

    const members = new Map(currentGroup.members);
    if (removeMemberId) members.delete(removeMemberId);
    if (addMemberId) members.set(addMemberId, 1);

    if (members.size !== 3) {
      throw new Error(
        `Triage panel must always have exactly 3 members (would have ${members.size}).`,
      );
    }

    existingContract.version = (existingContract.version ?? 0) + 1;
    existingContract.groups = {
      ...existingContract.groups,
      [PANEL_GROUP_POSITION]: new Group(members, PANEL_REQUIRED_POWER),
    };

    await sdk.contracts.update({
      dataContract: existingContract,
      identityKey,
      signer,
    });

    log?.("Panel roster updated.", "success");
  } catch (e) {
    log?.(`Roster update error: ${errorMessage(e)}`, "error");
    throw e;
  }
}
