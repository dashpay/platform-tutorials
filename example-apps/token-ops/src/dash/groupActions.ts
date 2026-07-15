/**
 * Discover pending TokenOps group actions and who has signed them.
 *
 * A "group action" is created the moment a group member proposes a governed
 * token action — it stays ACTIVE until accumulated signing power
 * reaches the group's requiredPower, at which point Platform executes it.
 * `listActionSigners` is how the UI shows "1 of 2 required" progress and
 * disables the sign button for someone who already signed.
 *
 * Group actions live under a specific group position. TokenOps maps each
 * operation to an explicit group so future functions can use different
 * authorities.
 *
 * SDK methods: sdk.group.actions(...), sdk.group.actionSigners(...)
 */
import type { Logger } from "./logger";
import type { DashSdk } from "./types";

export interface PendingAction {
  actionId: string;
  proposerId: string;
  eventName: string;
  params: PendingTokenActionParams | null;
}

export type PendingTokenActionParams =
  | {
      kind: "mint";
      amount: bigint;
      recipientId: string;
      publicNote?: string;
    }
  | {
      kind: "burn";
      amount: bigint;
      burnFromId: string;
      publicNote?: string;
    }
  | {
      kind: "freeze";
      targetIdentityId: string;
      publicNote?: string;
    }
  | {
      kind: "unfreeze";
      targetIdentityId: string;
      publicNote?: string;
    }
  | {
      kind: "destroyFrozen";
      targetIdentityId: string;
      amount?: bigint;
      publicNote?: string;
    }
  | {
      kind: "emergency";
      action: "pause" | "resume";
      publicNote?: string;
    };

/**
 * Best-effort human description of a group action's event. `GroupAction`
 * only exposes a raw `eventName()`/`tokenEvent()` pair — this maps the
 * common token-related event names into UI-friendly text, falling back to
 * the raw name for anything unrecognized.
 */
export function describeGroupAction(eventName: string): string {
  const lower = eventName.toLowerCase();
  if (lower.includes("mint")) return "Mint proposal";
  if (lower.includes("burn")) return "Burn proposal";
  if (lower.includes("emergency") || lower.includes("pause"))
    return "Emergency action proposal";
  if (lower.includes("freeze") && !lower.includes("unfreeze"))
    return "Freeze proposal";
  if (lower.includes("unfreeze")) return "Unfreeze proposal";
  if (lower.includes("destroy")) return "Destroy frozen funds proposal";
  if (lower.includes("config")) return "Configuration update proposal";
  return eventName;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function tokenEventFromAction(action: unknown): UnknownRecord | null {
  if (!isRecord(action)) return null;
  const event = action.event;
  if (isRecord(event) && typeof event.tokenEvent === "function") {
    const tokenEvent = event.tokenEvent();
    if (isRecord(tokenEvent) && typeof tokenEvent.toJSON === "function") {
      const json = tokenEvent.toJSON();
      return isRecord(json) ? json : null;
    }
  }
  if (typeof action.toJSON === "function") {
    const json = action.toJSON();
    if (!isRecord(json)) return null;
    const eventJson = json.event;
    if (!isRecord(eventJson)) return null;
    const data = eventJson.data;
    return isRecord(data) ? data : null;
  }
  return null;
}

function optionalNote(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function amount(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value))
    return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

function identityId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function emergencyAction(value: unknown): "pause" | "resume" | null {
  if (value === 0 || value === "0" || value === "pause" || value === "Pause") {
    return "pause";
  }
  if (
    value === 1 ||
    value === "1" ||
    value === "resume" ||
    value === "Resume"
  ) {
    return "resume";
  }
  return null;
}

export function parsePendingTokenActionParams(
  action: unknown,
): PendingTokenActionParams | null {
  const tokenEvent = tokenEventFromAction(action);
  if (!tokenEvent || !Array.isArray(tokenEvent.data)) return null;
  const [first, second, third] = tokenEvent.data;
  if (tokenEvent.type === "mint") {
    const mintAmount = amount(first);
    const recipientId = identityId(second);
    if (mintAmount === null || !recipientId) return null;
    return {
      kind: "mint",
      amount: mintAmount,
      recipientId,
      publicNote: optionalNote(third),
    };
  }
  if (tokenEvent.type === "burn") {
    const burnAmount = amount(first);
    const burnFromId = identityId(second);
    if (burnAmount === null || !burnFromId) return null;
    return {
      kind: "burn",
      amount: burnAmount,
      burnFromId,
      publicNote: optionalNote(third),
    };
  }
  if (tokenEvent.type === "freeze") {
    const targetIdentityId = identityId(first);
    if (!targetIdentityId) return null;
    return {
      kind: "freeze",
      targetIdentityId,
      publicNote: optionalNote(second),
    };
  }
  if (tokenEvent.type === "unfreeze") {
    const targetIdentityId = identityId(first);
    if (!targetIdentityId) return null;
    return {
      kind: "unfreeze",
      targetIdentityId,
      publicNote: optionalNote(second),
    };
  }
  if (tokenEvent.type === "destroyFrozenFunds") {
    const targetIdentityId = identityId(first);
    const destroyedAmount = amount(second);
    if (!targetIdentityId) return null;
    return {
      kind: "destroyFrozen",
      targetIdentityId,
      amount: destroyedAmount ?? undefined,
      publicNote: optionalNote(third),
    };
  }
  if (tokenEvent.type === "emergencyAction") {
    const action = emergencyAction(first);
    if (!action) return null;
    return {
      kind: "emergency",
      action,
      publicNote: optionalNote(second),
    };
  }
  return null;
}

/**
 * Hard cap on ACTIVE actions returned per group. TokenOps issues a single
 * `sdk.group.actions` query (no cursor pagination), so later proposals beyond
 * this limit are not shown.
 */
export const PENDING_ACTIONS_QUERY_LIMIT = 100;

export async function listPendingActions({
  sdk,
  contractId,
  groupPosition,
  log,
}: {
  sdk: DashSdk;
  contractId: string;
  /** Explicit group position for this action family. */
  groupPosition: number;
  log?: Logger;
}): Promise<PendingAction[]> {
  log?.("Loading pending group actions...");
  // One query only — TokenOps does not walk `startAt` pages. The explicit
  // limit documents the UI surface: up to PENDING_ACTIONS_QUERY_LIMIT ACTIVE
  // actions per group.
  const actions = await sdk.group.actions({
    dataContractId: contractId,
    groupContractPosition: groupPosition,
    status: "ACTIVE",
    limit: PENDING_ACTIONS_QUERY_LIMIT,
  });

  const pending: PendingAction[] = [];
  for (const [actionId, action] of actions) {
    if (!action) continue;
    pending.push({
      actionId,
      proposerId: action.proposerId.toString(),
      eventName: action.event.eventName(),
      params: parsePendingTokenActionParams(action),
    });
  }
  log?.(`Found ${pending.length} pending action(s).`);
  return pending;
}

export interface ActionSignerProgress {
  signers: Map<string, bigint>;
  signedPower: bigint;
  requiredPower: number;
  hasSigned: (identityId: string) => boolean;
}

export async function listActionSigners({
  sdk,
  contractId,
  groupPosition,
  actionId,
  requiredPower,
  log,
}: {
  sdk: DashSdk;
  contractId: string;
  /** Explicit group position for this action family. */
  groupPosition: number;
  actionId: string;
  requiredPower: number;
  log?: Logger;
}): Promise<ActionSignerProgress> {
  const signers = await sdk.group.actionSigners({
    dataContractId: contractId,
    groupContractPosition: groupPosition,
    // Only ever called for actions surfaced by listPendingActions, which
    // queries status: 'ACTIVE' — no UI path queries signers for a closed
    // action, so this doesn't need to be a parameter (yet).
    status: "ACTIVE",
    actionId,
  });
  let signedPower = 0n;
  for (const power of signers.values()) signedPower += power;
  log?.(`Action ${actionId}: ${signedPower}/${requiredPower} power signed.`);
  return {
    signers,
    signedPower,
    requiredPower,
    hasSigned: (identityId: string) => signers.has(identityId),
  };
}
