/**
 * Propose or co-sign a Triage Panel reversal of a mistaken freeze.
 *
 * Same propose/co-sign unification as freezeCredit.ts — see that file's
 * header for the full explanation of `groupInfo`. This is the safety valve:
 * if the panel froze the wrong researcher (or new evidence clears them),
 * unfreeze restores their ability to spend credits without needing a
 * destroy to have happened. `report.unfreezeRules` is gated on the same
 * Triage Panel group as freeze/destroy.
 *
 * SDK method: sdk.tokens.unfreeze({ ..., groupInfo })
 */
import { GroupStateTransitionInfoStatus } from "@dashevo/evo-sdk";

import { PANEL_GROUP_POSITION } from "./contract";
import { errorMessage, type Logger } from "./logger";
import { RESEARCHER_CREDIT_POSITION } from "./researcherCredit";
import type {
  DashKeyManager,
  DashSdk,
  DashTokenGroupActionResult,
} from "./types";

export async function unfreezeCredit({
  sdk,
  keyManager,
  contractId,
  frozenIdentityId,
  actionId,
  publicNote,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  frozenIdentityId: string;
  /** Pass the pending action's ID to co-sign; omit to propose a new one. */
  actionId?: string;
  publicNote?: string;
  log?: Logger;
}): Promise<DashTokenGroupActionResult> {
  try {
    const { identity, identityKey, signer } = await keyManager.getAuth();

    const groupInfo = actionId
      ? GroupStateTransitionInfoStatus.otherSigner(
          PANEL_GROUP_POSITION,
          actionId,
        )
      : GroupStateTransitionInfoStatus.proposer(PANEL_GROUP_POSITION);

    log?.(
      actionId
        ? `Co-signing unfreeze proposal for ${frozenIdentityId}…`
        : `Proposing unfreeze for ${frozenIdentityId}…`,
    );

    const result = await sdk.tokens.unfreeze({
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
        `Unfreeze executed — ${frozenIdentityId} can spend credits again.`,
        "success",
      );
    } else {
      log?.(
        `Unfreeze proposal recorded (power ${result.groupPower ?? "?"}), awaiting more signatures.`,
      );
    }
    return result;
  } catch (e) {
    log?.(`Unfreeze error: ${errorMessage(e)}`, "error");
    throw e;
  }
}
