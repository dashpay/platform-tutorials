// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PendingActionsView } from "../src/components/PendingActionsView";
import { fetchTokenOpsGovernance } from "../src/dash/governance";
import { listActionSigners, listPendingActions } from "../src/dash/groupActions";
import { mintToken } from "../src/dash/tokenOperations";
import { useSession } from "../src/session/useSession";

vi.mock("../src/dash/governance", () => ({
  fetchTokenOpsGovernance: vi.fn(),
}));

vi.mock("../src/dash/groupActions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/dash/groupActions")>();
  return {
    ...actual,
    listPendingActions: vi.fn(),
    listActionSigners: vi.fn(),
  };
});

vi.mock("../src/dash/tokenOperations", () => ({
  mintToken: vi.fn(),
  burnToken: vi.fn(),
  freezeToken: vi.fn(),
  unfreezeToken: vi.fn(),
  destroyFrozenToken: vi.fn(),
  emergencyTokenAction: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: vi.fn(),
}));

describe("PendingActionsView", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lets an eligible unsigned member co-sign a supported pending action", async () => {
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      sdk: {},
      keyManager: { id: "key-manager" },
      contractId: "contract-1",
      identityId: "member-b",
      log: vi.fn(),
    } as never);
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue({
      groups: [
        {
          groupPosition: 0,
          requiredPower: 2,
          members: new Map([
            ["member-a", 1],
            ["member-b", 1],
          ]),
        },
      ],
      rules: [],
    });
    vi.mocked(listPendingActions).mockResolvedValue([
      {
        actionId: "action-1",
        proposerId: "member-a",
        eventName: "Token: mint",
        params: {
          kind: "mint",
          amount: 3n,
          recipientId: "recipient-1",
          publicNote: "mint note",
        },
      },
    ]);
    vi.mocked(listActionSigners).mockResolvedValue({
      signers: new Map([["member-a", 1n]]),
      signedPower: 1n,
      requiredPower: 2,
      hasSigned: (identityId: string) => identityId === "member-a",
    });
    vi.mocked(mintToken).mockResolvedValue({ groupPower: 2 });

    render(<PendingActionsView />);

    const button = await screen.findByRole("button", { name: "Co-sign" });
    fireEvent.click(button);

    await waitFor(() =>
      expect(mintToken).toHaveBeenCalledWith(
        expect.objectContaining({
          contractId: "contract-1",
          actionId: "action-1",
          groupPosition: 0,
          amount: 3n,
          recipientId: "recipient-1",
          publicNote: "mint note",
        }),
      ),
    );
  });
});
