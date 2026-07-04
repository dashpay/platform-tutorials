/**
 * Rotate the Triage Panel to a new 3-member roster.
 *
 * A published group is immutable — Platform's contract-update validation
 * rejects any change to an existing group with
 * DataContractUpdateActionNotAllowedError ("change group at position N is
 * not allowed"), so there is no in-place add/remove/swap-member operation.
 * What IS allowed: appending a new group at the next contiguous position,
 * and (because this token sets mainControlGroupCanBeModified to
 * ContractOwner) repointing the token's mainControlGroup at it. Since
 * freeze/unfreeze/destroy are gated on AuthorizedActionTakers.MainGroup(),
 * governance follows the repoint automatically. Rotation is therefore a
 * two-step, owner-signed flow:
 *
 *   1. sdk.contracts.update(...) — append `new Group(newMembers, 2)` at the
 *      next contiguous position, with `.version` bumped.
 *   2. sdk.tokens.configUpdate(...) with
 *      TokenConfigurationChangeItem.MainControlGroupItem(newPosition).
 *
 * Both transitions are signed by the CONTRACT OWNER — the bounty operator
 * administers roster membership (matching the original UI model); the
 * panel does not self-govern its own composition. A non-owner's call is
 * rejected on-chain. Old groups remain in the contract forever (immutable,
 * but powerless: nothing points at them once mainControlGroup moves on).
 *
 * Fetches fresh immediately before mutating so two racing rotations don't
 * collide on a stale `.version`.
 *
 * SDK methods: sdk.contracts.fetch(...), sdk.contracts.update(...),
 * sdk.tokens.configUpdate({ configurationChangeItem:
 * TokenConfigurationChangeItem.MainControlGroupItem(n) })
 */
import { TokenConfigurationChangeItem } from "@dashevo/evo-sdk";

import { createTriagePanelGroup } from "./contract";
import { errorMessage, type Logger } from "./logger";
import { RESEARCHER_CREDIT_POSITION } from "./researcherCredit";
import type { DashKeyManager, DashSdk } from "./types";

export async function rotatePanelRoster({
  sdk,
  keyManager,
  contractId,
  newPanelMemberIds,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  /** Exactly 3 identity IDs for the replacement roster. */
  newPanelMemberIds: string[];
  log?: Logger;
}): Promise<number> {
  try {
    const { identity, identityKey, signer } = await keyManager.getAuth();

    const dataContract = await sdk.contracts.fetch(contractId);
    if (!dataContract) throw new Error(`Contract ${contractId} not found.`);

    // Group positions must stay contiguous (0, 1, 2, …) for the update to
    // validate, so the append slot is exactly the current group count.
    const existingGroups = dataContract.groups ?? {};
    const positions = Object.keys(existingGroups).map(Number);
    const newPosition = positions.length ? Math.max(...positions) + 1 : 0;

    log?.(`Appending replacement panel as group ${newPosition}…`);
    dataContract.groups = {
      ...existingGroups,
      [newPosition]: createTriagePanelGroup(newPanelMemberIds),
    };
    dataContract.version = (dataContract.version ?? 0) + 1;

    await sdk.contracts.update({ dataContract, identityKey, signer });

    log?.(`Repointing token main control group at group ${newPosition}…`);
    await sdk.tokens.configUpdate({
      dataContractId: contractId,
      tokenPosition: RESEARCHER_CREDIT_POSITION,
      identityId: identity.id.toString(),
      configurationChangeItem:
        TokenConfigurationChangeItem.MainControlGroupItem(newPosition),
      identityKey,
      signer,
    });

    log?.(`Panel rotated — group ${newPosition} now governs.`, "success");
    return newPosition;
  } catch (e) {
    log?.(`Roster rotation error: ${errorMessage(e)}`, "error");
    throw e;
  }
}
