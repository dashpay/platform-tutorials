/**
 * Propose or co-sign a Triage Panel freeze of a researcher's Researcher
 * Credit balance.
 *
 * `freezeRules` gates this on `AuthorizedActionTakers.MainGroup()` — the
 * token's current main control group, 2-of-3. That position is dynamic
 * (group 0 at launch, higher after a roster rotation), so callers pass the
 * active `groupPosition` they resolved via panel.ts's fetchPanelInfo /
 * fetchActivePanelPosition. A single call from `sdk.tokens.freeze(...)`
 * covers both roles depending on `groupInfo`:
 *   - Proposer (first signer): pass no `actionId`. Uses
 *     `GroupStateTransitionInfoStatus.proposer(groupContractPosition)`,
 *     which creates a new pending group action at power 1 — not yet
 *     executed, since 1 < requiredPower (2).
 *   - Other signer (second+): pass the pending action's `actionId`
 *     (discovered via groupActions.ts's `listPendingActions`). Uses
 *     `GroupStateTransitionInfoStatus.otherSigner(groupContractPosition, actionId)`.
 *     Once accumulated power reaches requiredPower, Platform executes the
 *     freeze in this same call.
 *
 * One file (not two) handles both roles: the SDK call shape is identical
 * modulo `groupInfo`, and "do I have a pending actionId to co-sign, or am I
 * originating?" is a single decision the caller needs to make once per
 * click — splitting it into two files would just relocate an if/else into
 * an import statement.
 *
 * The result's `groupPower` field is present while the action is still
 * accumulating signatures; `document` is present once it has executed —
 * branch UI logic on which is present rather than re-querying.
 *
 * SDK method: sdk.tokens.freeze({ ..., groupInfo })
 */
import { GroupStateTransitionInfoStatus } from "@dashevo/evo-sdk";

import { errorMessage, type Logger } from "./logger";
import { RESEARCHER_CREDIT_POSITION } from "./researcherCredit";
import type {
  DashKeyManager,
  DashSdk,
  DashTokenGroupActionResult,
} from "./types";

export async function freezeCredit({
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
        ? `Co-signing freeze proposal for ${frozenIdentityId}…`
        : `Proposing freeze for ${frozenIdentityId}…`,
    );

    const result = await sdk.tokens.freeze({
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
      log?.(`Freeze executed — ${frozenIdentityId} is now frozen.`, "success");
    } else {
      log?.(
        `Freeze proposal recorded (power ${result.groupPower ?? "?"}), awaiting more signatures.`,
      );
    }
    return result;
  } catch (e) {
    log?.(`Freeze error: ${errorMessage(e)}`, "error");
    throw e;
  }
}
