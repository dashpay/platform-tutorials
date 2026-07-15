/**
 * Group-managed TokenOps mutations.
 *
 * Each helper accepts an optional `actionId`: omitted means "propose a new
 * group action"; present means "co-sign this pending action".
 *
 * SDK methods: sdk.tokens.mint / burn / transfer / freeze / unfreeze /
 * destroyFrozen / emergencyAction / configUpdate.
 */
import { TOKEN_POSITION, type ReassignableRuleKind } from "./contract";
import { errorMessage, type Logger } from "./logger";
import { loadSdkModule } from "./sdkModule";
import type {
  DashKeyManager,
  DashSdk,
  DashTokenGroupActionResult,
} from "./types";

async function groupInfo(groupPosition: number, actionId?: string) {
  const { GroupStateTransitionInfoStatus } = await loadSdkModule();
  return actionId
    ? GroupStateTransitionInfoStatus.otherSigner(groupPosition, actionId)
    : GroupStateTransitionInfoStatus.proposer(groupPosition);
}

function notePrefix(actionId: string | undefined): string {
  return actionId ? "Co-signing" : "Proposing";
}

function publicNoteForSubmission(
  actionId: string | undefined,
  publicNote: string | undefined,
  fallback: string,
): string | undefined {
  return actionId ? undefined : (publicNote ?? fallback);
}

export async function mintToken({
  sdk,
  keyManager,
  contractId,
  groupPosition,
  amount,
  recipientId,
  actionId,
  publicNote,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  groupPosition: number;
  amount: bigint;
  recipientId?: string;
  actionId?: string;
  publicNote?: string;
  log?: Logger;
}): Promise<DashTokenGroupActionResult> {
  try {
    const { identity, identityKey, signer } = await keyManager.getAuth();
    log?.(`${notePrefix(actionId)} mint of ${amount.toString()} token(s)...`);
    return await sdk.tokens.mint({
      dataContractId: contractId,
      tokenPosition: TOKEN_POSITION,
      amount,
      identityId: identity.id.toString(),
      recipientId: recipientId?.trim() || undefined,
      publicNote: publicNoteForSubmission(
        actionId,
        publicNote,
        "TokenOps mint",
      ),
      identityKey,
      signer,
      groupInfo: await groupInfo(groupPosition, actionId),
    });
  } catch (err) {
    log?.(`Mint error: ${errorMessage(err)}`, "error");
    throw err;
  }
}

export async function burnToken({
  sdk,
  keyManager,
  contractId,
  groupPosition,
  amount,
  actionId,
  publicNote,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  groupPosition: number;
  amount: bigint;
  actionId?: string;
  publicNote?: string;
  log?: Logger;
}): Promise<unknown> {
  try {
    const { identity, identityKey, signer } = await keyManager.getAuth();
    log?.(`${notePrefix(actionId)} burn of ${amount.toString()} token(s)...`);
    return await sdk.tokens.burn({
      dataContractId: contractId,
      tokenPosition: TOKEN_POSITION,
      amount,
      identityId: identity.id.toString(),
      publicNote: publicNoteForSubmission(
        actionId,
        publicNote,
        "TokenOps burn",
      ),
      identityKey,
      signer,
      groupInfo: await groupInfo(groupPosition, actionId),
    });
  } catch (err) {
    log?.(`Burn error: ${errorMessage(err)}`, "error");
    throw err;
  }
}

export async function transferToken({
  sdk,
  keyManager,
  contractId,
  amount,
  recipientId,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  amount: bigint;
  recipientId: string;
  log?: Logger;
}): Promise<unknown> {
  const { identity, identityKey, signer } = await keyManager.getAuth();
  log?.(`Transferring ${amount.toString()} token(s)...`);
  return sdk.tokens.transfer({
    dataContractId: contractId,
    tokenPosition: TOKEN_POSITION,
    amount,
    senderId: identity.id.toString(),
    recipientId: recipientId.trim(),
    publicNote: "TokenOps transfer",
    identityKey,
    signer,
  });
}

export async function freezeToken({
  sdk,
  keyManager,
  contractId,
  groupPosition,
  targetIdentityId,
  actionId,
  publicNote,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  groupPosition: number;
  targetIdentityId: string;
  actionId?: string;
  publicNote?: string;
  log?: Logger;
}) {
  const { identity, identityKey, signer } = await keyManager.getAuth();
  log?.(`${notePrefix(actionId)} freeze for ${targetIdentityId}...`);
  return sdk.tokens.freeze({
    dataContractId: contractId,
    tokenPosition: TOKEN_POSITION,
    authorityId: identity.id.toString(),
    frozenIdentityId: targetIdentityId.trim(),
    publicNote: publicNoteForSubmission(
      actionId,
      publicNote,
      "TokenOps freeze",
    ),
    identityKey,
    signer,
    groupInfo: await groupInfo(groupPosition, actionId),
  });
}

export async function unfreezeToken({
  sdk,
  keyManager,
  contractId,
  groupPosition,
  targetIdentityId,
  actionId,
  publicNote,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  groupPosition: number;
  targetIdentityId: string;
  actionId?: string;
  publicNote?: string;
  log?: Logger;
}) {
  const { identity, identityKey, signer } = await keyManager.getAuth();
  log?.(`${notePrefix(actionId)} unfreeze for ${targetIdentityId}...`);
  return sdk.tokens.unfreeze({
    dataContractId: contractId,
    tokenPosition: TOKEN_POSITION,
    authorityId: identity.id.toString(),
    frozenIdentityId: targetIdentityId.trim(),
    publicNote: publicNoteForSubmission(
      actionId,
      publicNote,
      "TokenOps unfreeze",
    ),
    identityKey,
    signer,
    groupInfo: await groupInfo(groupPosition, actionId),
  });
}

export async function destroyFrozenToken({
  sdk,
  keyManager,
  contractId,
  groupPosition,
  targetIdentityId,
  actionId,
  publicNote,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  groupPosition: number;
  targetIdentityId: string;
  actionId?: string;
  publicNote?: string;
  log?: Logger;
}) {
  const { identity, identityKey, signer } = await keyManager.getAuth();
  log?.(
    `${notePrefix(actionId)} destroy frozen funds for ${targetIdentityId}...`,
  );
  return sdk.tokens.destroyFrozen({
    dataContractId: contractId,
    tokenPosition: TOKEN_POSITION,
    authorityId: identity.id.toString(),
    frozenIdentityId: targetIdentityId.trim(),
    publicNote: publicNoteForSubmission(
      actionId,
      publicNote,
      "TokenOps destroy frozen",
    ),
    identityKey,
    signer,
    groupInfo: await groupInfo(groupPosition, actionId),
  });
}

export async function emergencyTokenAction({
  sdk,
  keyManager,
  contractId,
  groupPosition,
  action,
  actionId,
  publicNote,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  groupPosition: number;
  action: "pause" | "resume";
  actionId?: string;
  publicNote?: string;
  log?: Logger;
}) {
  const { identity, identityKey, signer } = await keyManager.getAuth();
  log?.(`${notePrefix(actionId)} token ${action}...`);
  return sdk.tokens.emergencyAction({
    dataContractId: contractId,
    tokenPosition: TOKEN_POSITION,
    authorityId: identity.id.toString(),
    action,
    publicNote: publicNoteForSubmission(
      actionId,
      publicNote,
      `TokenOps ${action}`,
    ),
    identityKey,
    signer,
    groupInfo: await groupInfo(groupPosition, actionId),
  });
}

export async function configurationChangeItemForRule(
  ruleKind: ReassignableRuleKind,
  groupPosition: number,
) {
  const { AuthorizedActionTakers, TokenConfigurationChangeItem } =
    await loadSdkModule();
  const actionTaker = AuthorizedActionTakers.Group(groupPosition);
  if (ruleKind === "manualMinting") {
    return TokenConfigurationChangeItem.ManualMintingItem(actionTaker);
  }
  if (ruleKind === "manualBurning") {
    return TokenConfigurationChangeItem.ManualBurningItem(actionTaker);
  }
  if (ruleKind === "freeze") {
    return TokenConfigurationChangeItem.FreezeItem(actionTaker);
  }
  if (ruleKind === "unfreeze") {
    return TokenConfigurationChangeItem.UnfreezeItem(actionTaker);
  }
  if (ruleKind === "destroyFrozenFunds") {
    return TokenConfigurationChangeItem.DestroyFrozenFundsItem(actionTaker);
  }
  return TokenConfigurationChangeItem.EmergencyActionItem(actionTaker);
}

export async function assignTokenFunctionGroup({
  sdk,
  keyManager,
  contractId,
  ownerId,
  ruleKind,
  groupPosition,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  ownerId: string;
  ruleKind: ReassignableRuleKind;
  groupPosition: number;
  log?: Logger;
}) {
  const { identityKey, signer } = await keyManager.getAuth();
  log?.(`Assigning ${ruleKind} operator to group ${groupPosition}...`);
  return sdk.tokens.configUpdate({
    dataContractId: contractId,
    tokenPosition: TOKEN_POSITION,
    identityId: ownerId,
    configurationChangeItem: await configurationChangeItemForRule(
      ruleKind,
      groupPosition,
    ),
    publicNote: `TokenOps assign ${ruleKind} to group ${groupPosition}`,
    identityKey,
    signer,
  });
}
