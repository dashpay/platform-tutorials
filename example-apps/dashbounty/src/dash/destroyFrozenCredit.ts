/**
 * Propose or co-sign a Triage Panel slash (destroy) of a frozen researcher's
 * remaining Researcher Credit balance.
 *
 * Same propose/co-sign unification as freezeCredit.ts — see that file's
 * header for the full explanation of `groupInfo` and why one function
 * covers both roles.
 *
 * `sdk.tokens.destroyFrozen(...)` has no destination/effect parameter at
 * the protocol level: it is an unconditional burn. Nobody — not the
 * program operator, not the panel — receives the destroyed credits. That's
 * deliberate: paying the panel (or anyone) from a slash would corrupt its
 * incentive to freeze/destroy fairly, the same reasoning proof-of-stake
 * systems burn slashed stake rather than paying it to whoever reported the
 * misbehavior.
 *
 * A destroy only ever targets an identity that is already frozen — Platform
 * will reject destroyFrozen against a balance that was never frozen.
 *
 * SDK method: sdk.tokens.destroyFrozen({ ..., groupInfo })
 */
import { GroupStateTransitionInfoStatus } from "@dashevo/evo-sdk";

import { errorMessage, type Logger } from "./logger";
import { RESEARCHER_CREDIT_POSITION } from "./researcherCredit";
import type {
  DashKeyManager,
  DashSdk,
  DashTokenGroupActionResult,
} from "./types";

export async function destroyFrozenCredit({
  sdk,
  keyManager,
  contractId,
  groupPosition,
  frozenIdentityId,
  actionId,
  publicNote,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  /** The ACTIVE main-control-group position — see fetchActivePanelPosition. */
  groupPosition: number;
  frozenIdentityId: string;
  /** Pass the pending action's ID to co-sign; omit to propose a new one. */
  actionId?: string;
  publicNote?: string;
  log?: Logger;
}): Promise<DashTokenGroupActionResult> {
  try {
    const { identity, identityKey, signer } = await keyManager.getAuth();

    const groupInfo = actionId
      ? GroupStateTransitionInfoStatus.otherSigner(groupPosition, actionId)
      : GroupStateTransitionInfoStatus.proposer(groupPosition);

    log?.(
      actionId
        ? `Co-signing slash proposal for ${frozenIdentityId}…`
        : `Proposing slash (permanent) for ${frozenIdentityId}…`,
    );

    const result = await sdk.tokens.destroyFrozen({
      dataContractId: contractId,
      tokenPosition: RESEARCHER_CREDIT_POSITION,
      authorityId: identity.id.toString(),
      frozenIdentityId,
      publicNote,
      identityKey,
      signer,
      groupInfo,
    });

    if (result.document) {
      log?.(
        `Slash executed — ${frozenIdentityId}'s remaining credits are permanently destroyed.`,
        "success",
      );
    } else {
      log?.(
        `Slash proposal recorded (power ${result.groupPower ?? "?"}), awaiting more signatures.`,
      );
    }
    return result;
  } catch (e) {
    log?.(`Slash error: ${errorMessage(e)}`, "error");
    throw e;
  }
}
