import { describe, expect, it, vi } from "vitest";

import {
  describeGroupAction,
  listActionSigners,
  listPendingActions,
  parsePendingTokenActionParams,
  PENDING_ACTIONS_QUERY_LIMIT,
} from "../src/dash/groupActions";

/**
 * `parsePendingTokenActionParams` accepts two runtime shapes, so every parse
 * case is exercised through both to prove the extraction is shape-agnostic:
 *   - `tokenEvent()` shape: action.event.tokenEvent().toJSON()
 *   - `toJSON()` shape:     action.toJSON().event.data
 */
function tokenEventShape(type: string, data: unknown[]) {
  return {
    event: {
      tokenEvent: () => ({
        toJSON: () => ({ type, data }),
      }),
    },
  };
}

function toJsonShape(type: string, data: unknown[]) {
  return {
    toJSON: () => ({
      event: { data: { type, data } },
    }),
  };
}

/** Run an expectation against both accepted action shapes. */
function forBothShapes(
  type: string,
  data: unknown[],
  assert: (parsed: ReturnType<typeof parsePendingTokenActionParams>) => void,
) {
  assert(parsePendingTokenActionParams(tokenEventShape(type, data)));
  assert(parsePendingTokenActionParams(toJsonShape(type, data)));
}

describe("parsePendingTokenActionParams", () => {
  it("parses mint with amount coercion and optional note", () => {
    forBothShapes("mint", ["7", "recipient-1", "note"], (parsed) =>
      expect(parsed).toEqual({
        kind: "mint",
        amount: 7n,
        recipientId: "recipient-1",
        publicNote: "note",
      }),
    );
    forBothShapes("mint", [3, "recipient-1", null], (parsed) =>
      expect(parsed).toEqual({
        kind: "mint",
        amount: 3n,
        recipientId: "recipient-1",
        publicNote: undefined,
      }),
    );
  });

  it("rejects mint with a missing amount or empty recipient", () => {
    forBothShapes("mint", ["not-a-number", "recipient-1"], (parsed) =>
      expect(parsed).toBeNull(),
    );
    forBothShapes("mint", ["7", ""], (parsed) => expect(parsed).toBeNull());
  });

  it("parses burn and maps the second field to burnFromId", () => {
    forBothShapes("burn", ["5", "burn-from-1", "why"], (parsed) =>
      expect(parsed).toEqual({
        kind: "burn",
        amount: 5n,
        burnFromId: "burn-from-1",
        publicNote: "why",
      }),
    );
  });

  it("rejects burn with a missing amount or empty source", () => {
    forBothShapes("burn", [null, "burn-from-1"], (parsed) =>
      expect(parsed).toBeNull(),
    );
    forBothShapes("burn", ["5", ""], (parsed) => expect(parsed).toBeNull());
  });

  it("parses freeze and unfreeze targets", () => {
    forBothShapes("freeze", ["target-1", "note"], (parsed) =>
      expect(parsed).toEqual({
        kind: "freeze",
        targetIdentityId: "target-1",
        publicNote: "note",
      }),
    );
    forBothShapes("unfreeze", ["target-2"], (parsed) =>
      expect(parsed).toEqual({
        kind: "unfreeze",
        targetIdentityId: "target-2",
        publicNote: undefined,
      }),
    );
  });

  it("rejects freeze/unfreeze with an empty target", () => {
    forBothShapes("freeze", [""], (parsed) => expect(parsed).toBeNull());
    forBothShapes("unfreeze", [null], (parsed) => expect(parsed).toBeNull());
  });

  it("parses destroyFrozenFunds with an optional amount", () => {
    forBothShapes("destroyFrozenFunds", ["target-1", "9", "note"], (parsed) =>
      expect(parsed).toEqual({
        kind: "destroyFrozen",
        targetIdentityId: "target-1",
        amount: 9n,
        publicNote: "note",
      }),
    );
    forBothShapes("destroyFrozenFunds", ["target-1"], (parsed) =>
      expect(parsed).toEqual({
        kind: "destroyFrozen",
        targetIdentityId: "target-1",
        amount: undefined,
        publicNote: undefined,
      }),
    );
  });

  it("rejects destroyFrozenFunds with an empty target", () => {
    forBothShapes("destroyFrozenFunds", ["", "9"], (parsed) =>
      expect(parsed).toBeNull(),
    );
  });

  it("maps every emergencyAction encoding to pause or resume", () => {
    for (const pause of [0, "0", "pause", "Pause"]) {
      forBothShapes("emergencyAction", [pause, null], (parsed) =>
        expect(parsed).toEqual({
          kind: "emergency",
          action: "pause",
          publicNote: undefined,
        }),
      );
    }
    for (const resume of [1, "1", "resume", "Resume"]) {
      forBothShapes("emergencyAction", [resume, "note"], (parsed) =>
        expect(parsed).toEqual({
          kind: "emergency",
          action: "resume",
          publicNote: "note",
        }),
      );
    }
  });

  it("rejects an unrecognized emergencyAction value", () => {
    forBothShapes("emergencyAction", [2], (parsed) =>
      expect(parsed).toBeNull(),
    );
  });

  it("coerces amounts from string, number, and rejects unsafe/non-numeric", () => {
    // Safe integer number and decimal-digit string both coerce; a float and a
    // non-numeric string do not (amount() returns null -> mint rejected).
    forBothShapes("mint", [42, "r"], (parsed) =>
      expect(parsed).toMatchObject({ amount: 42n }),
    );
    forBothShapes("mint", ["1000000", "r"], (parsed) =>
      expect(parsed).toMatchObject({ amount: 1000000n }),
    );
    forBothShapes("mint", [1.5, "r"], (parsed) => expect(parsed).toBeNull());
    forBothShapes("mint", ["12x", "r"], (parsed) => expect(parsed).toBeNull());
    forBothShapes("mint", [Number.MAX_SAFE_INTEGER + 1, "r"], (parsed) =>
      expect(parsed).toBeNull(),
    );
  });

  it("returns null for structurally invalid actions", () => {
    // Unknown event type.
    forBothShapes("configUpdate", ["x"], (parsed) => expect(parsed).toBeNull());
    // data is not an array.
    expect(
      parsePendingTokenActionParams({
        event: {
          tokenEvent: () => ({ toJSON: () => ({ type: "mint", data: {} }) }),
        },
      }),
    ).toBeNull();
    // No tokenEvent() and no toJSON() -> no event extractable.
    expect(parsePendingTokenActionParams({})).toBeNull();
    expect(parsePendingTokenActionParams(null)).toBeNull();
  });
});

describe("describeGroupAction", () => {
  it("maps token event names to UI-friendly labels", () => {
    expect(describeGroupAction("TokenMintEvent")).toBe("Mint proposal");
    expect(describeGroupAction("TokenBurnEvent")).toBe("Burn proposal");
    expect(describeGroupAction("EmergencyActionEvent")).toBe(
      "Emergency action proposal",
    );
    expect(describeGroupAction("TokenPauseEvent")).toBe(
      "Emergency action proposal",
    );
    expect(describeGroupAction("TokenDestroyFrozenFundsEvent")).toBe(
      "Destroy frozen funds proposal",
    );
    expect(describeGroupAction("TokenConfigUpdateEvent")).toBe(
      "Configuration update proposal",
    );
  });

  it("distinguishes unfreeze from freeze despite the shared substring", () => {
    expect(describeGroupAction("TokenFreezeEvent")).toBe("Freeze proposal");
    expect(describeGroupAction("TokenUnfreezeEvent")).toBe("Unfreeze proposal");
  });

  it("falls back to the raw name for unrecognized events", () => {
    expect(describeGroupAction("SomethingElse")).toBe("SomethingElse");
  });
});

function makeAction(actionId: string, proposerId = "proposer-1") {
  return {
    proposerId: { toString: () => proposerId },
    event: {
      eventName: () => "TokenMintEvent",
      tokenEvent: () => ({
        toJSON: () => ({
          type: "mint",
          data: ["1", "recipient-1", null],
        }),
      }),
    },
  };
}

describe("listPendingActions", () => {
  it("issues one ACTIVE query with the documented per-group limit", async () => {
    const actions = vi.fn().mockResolvedValue(
      new Map([
        ["action-1", makeAction("action-1")],
        ["action-2", makeAction("action-2", "proposer-2")],
      ]),
    );

    const pending = await listPendingActions({
      sdk: { group: { actions } } as never,
      contractId: "contract-1",
      groupPosition: 0,
    });

    expect(PENDING_ACTIONS_QUERY_LIMIT).toBe(100);
    expect(actions).toHaveBeenCalledTimes(1);
    expect(actions).toHaveBeenCalledWith({
      dataContractId: "contract-1",
      groupContractPosition: 0,
      status: "ACTIVE",
      limit: PENDING_ACTIONS_QUERY_LIMIT,
    });
    expect(pending.map((entry) => entry.actionId)).toEqual([
      "action-1",
      "action-2",
    ]);
    expect(pending[0]?.params).toMatchObject({
      kind: "mint",
      amount: 1n,
      recipientId: "recipient-1",
    });
  });

  it("does not request additional pages even when the first page is full", async () => {
    const fullPage = new Map(
      Array.from({ length: PENDING_ACTIONS_QUERY_LIMIT }, (_, index) => [
        `action-${index + 1}`,
        makeAction(`action-${index + 1}`),
      ]),
    );
    const actions = vi.fn().mockResolvedValue(fullPage);

    const pending = await listPendingActions({
      sdk: { group: { actions } } as never,
      contractId: "contract-1",
      groupPosition: 2,
    });

    expect(actions).toHaveBeenCalledTimes(1);
    expect(actions.mock.calls[0][0]).not.toHaveProperty("startAt");
    expect(pending).toHaveLength(PENDING_ACTIONS_QUERY_LIMIT);
  });
});

describe("listActionSigners", () => {
  it("sums power across multiple signers and reports who has signed", async () => {
    const actionSigners = vi.fn().mockResolvedValue(
      new Map([
        ["a", 1n],
        ["b", 2n],
      ]),
    );

    const progress = await listActionSigners({
      sdk: { group: { actionSigners } } as never,
      contractId: "contract-1",
      groupPosition: 3,
      actionId: "action-1",
      requiredPower: 2,
    });

    expect(actionSigners).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ACTIVE",
        groupContractPosition: 3,
        actionId: "action-1",
      }),
    );
    expect(progress.signedPower).toBe(3n);
    expect(progress.requiredPower).toBe(2);
    expect(progress.hasSigned("a")).toBe(true);
    expect(progress.hasSigned("b")).toBe(true);
    expect(progress.hasSigned("missing")).toBe(false);
  });
});
