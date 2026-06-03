// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TokenTransferScreen } from "../src/components/TokenTransferScreen";
import type { DashKeyManager, DashSdk } from "../src/dash/types";
import type { ResolvedRecipient } from "../src/hooks/useResolvedRecipient";

const {
  mockUseSession,
  mockTransferDashMintTokens,
  mockUseDpnsName,
  mockUseResolvedRecipient,
} = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockTransferDashMintTokens: vi.fn(),
  mockUseDpnsName: vi.fn(),
  mockUseResolvedRecipient: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/dash/transferDashMintTokens", () => ({
  transferDashMintTokens: mockTransferDashMintTokens,
}));

vi.mock("../src/hooks/useDpnsName", () => ({
  useDpnsName: mockUseDpnsName,
}));

vi.mock("../src/hooks/useResolvedRecipient", () => ({
  useResolvedRecipient: mockUseResolvedRecipient,
}));

const sessionValue = {
  status: "authenticated",
  sdk: {} as DashSdk,
  keyManager: {} as DashKeyManager,
  identityId: "sender-1",
  log: vi.fn(),
};

const SAMPLE_ID = "5LmvdJbGAtnk2Z3y5bwa2YcX9hk5GhVePtkT21a2mxAn";
const idle: ResolvedRecipient = { status: "idle" };
function resolved(identityId: string): ResolvedRecipient {
  return { status: "resolved", identityId };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TokenTransferScreen", () => {
  it("keeps submit disabled with empty fields", () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue(idle);

    render(
      <TokenTransferScreen
        contractId="contract-1"
        dashMintTokenBalance={10n}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "Transfer" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("keeps submit disabled for invalid amount and unresolved DPNS name", () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue({ status: "not-found" });

    render(
      <TokenTransferScreen
        contractId="contract-1"
        dashMintTokenBalance={10n}
      />,
    );

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "1.5" },
    });
    fireEvent.change(screen.getByLabelText("Recipient identity or DPNS name"), {
      target: { value: "alice.dash" },
    });

    expect(screen.getByText("Enter a positive whole amount.")).toBeTruthy();
    expect(screen.getByText(/No identity found/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Transfer" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("submits a resolved DPNS identity ID", async () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue(resolved(SAMPLE_ID));
    mockTransferDashMintTokens.mockResolvedValueOnce(undefined);

    render(
      <TokenTransferScreen
        contractId="contract-1"
        dashMintTokenBalance={10n}
      />,
    );

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Recipient identity or DPNS name"), {
      target: { value: "Alice.dash" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));

    await waitFor(() => {
      expect(mockTransferDashMintTokens).toHaveBeenCalledWith({
        sdk: sessionValue.sdk,
        keyManager: sessionValue.keyManager,
        contractId: "contract-1",
        recipientId: SAMPLE_ID,
        amount: 2n,
        log: sessionValue.log,
      });
    });
  });

  it("submits trimmed raw identity input through ambiguous fallback", async () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue({ status: "not-found" });
    mockTransferDashMintTokens.mockResolvedValueOnce(undefined);

    render(
      <TokenTransferScreen
        contractId="contract-1"
        dashMintTokenBalance={10n}
      />,
    );

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByPlaceholderText("alice.dash or identity ID"), {
      target: { value: `  ${SAMPLE_ID}  ` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));

    await waitFor(() => {
      expect(mockTransferDashMintTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: SAMPLE_ID,
          amount: 3n,
        }),
      );
    });
  });

  it("trims whole-token amount input before submitting", async () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue(resolved(SAMPLE_ID));
    mockTransferDashMintTokens.mockResolvedValueOnce(undefined);

    render(
      <TokenTransferScreen
        contractId="contract-1"
        dashMintTokenBalance={10n}
      />,
    );

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "  7  " },
    });
    fireEvent.change(screen.getByLabelText("Recipient identity or DPNS name"), {
      target: { value: "alice.dash" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));

    await waitFor(() => {
      expect(mockTransferDashMintTokens).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 7n }),
      );
    });
  });

  it("rejects non-whole amount formats", () => {
    const invalidAmounts = ["1e3", "-1", "0x10", "1.5", "0"];

    for (const invalidAmount of invalidAmounts) {
      cleanup();
      vi.clearAllMocks();
      mockUseSession.mockReturnValue(sessionValue);
      mockUseDpnsName.mockReturnValue(null);
      mockUseResolvedRecipient.mockReturnValue(resolved(SAMPLE_ID));

      render(
        <TokenTransferScreen
          contractId="contract-1"
          dashMintTokenBalance={10n}
        />,
      );

      fireEvent.change(screen.getByLabelText("Amount"), {
        target: { value: invalidAmount },
      });
      fireEvent.change(
        screen.getByLabelText("Recipient identity or DPNS name"),
        {
          target: { value: "alice.dash" },
        },
      );

      expect(screen.getByText("Enter a positive whole amount.")).toBeTruthy();
      expect(
        (screen.getByRole("button", { name: "Transfer" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      expect(mockTransferDashMintTokens).not.toHaveBeenCalled();
    }
  });

  it("passes trimmed name and ambiguous inputs to the resolver hook", () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue(idle);

    render(
      <TokenTransferScreen
        contractId="contract-1"
        dashMintTokenBalance={10n}
      />,
    );

    fireEvent.change(screen.getByLabelText("Recipient identity or DPNS name"), {
      target: { value: "  Alice.dash  " },
    });
    expect(mockUseResolvedRecipient).toHaveBeenLastCalledWith(
      sessionValue.sdk,
      "Alice.dash",
    );

    fireEvent.change(screen.getByPlaceholderText("alice.dash or identity ID"), {
      target: { value: `  ${SAMPLE_ID}  ` },
    });
    expect(mockUseResolvedRecipient).toHaveBeenLastCalledWith(
      sessionValue.sdk,
      SAMPLE_ID,
    );
  });

  it("does not resolve invalid recipient input", () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue(idle);

    render(
      <TokenTransferScreen
        contractId="contract-1"
        dashMintTokenBalance={10n}
      />,
    );

    fireEvent.change(screen.getByLabelText("Recipient identity or DPNS name"), {
      target: { value: "alice@dash" },
    });

    expect(mockUseResolvedRecipient).toHaveBeenLastCalledWith(
      sessionValue.sdk,
      null,
    );
    expect(mockUseDpnsName).toHaveBeenLastCalledWith(sessionValue.sdk, null);
  });

  it("shows success, clears fields, and notifies the parent", async () => {
    const onTransferred = vi.fn();
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue(resolved(SAMPLE_ID));
    mockTransferDashMintTokens.mockResolvedValueOnce(undefined);

    render(
      <TokenTransferScreen
        contractId="contract-1"
        dashMintTokenBalance={10n}
        onTransferred={onTransferred}
      />,
    );

    const amount = screen.getByLabelText("Amount") as HTMLInputElement;
    const recipient = screen.getByLabelText(
      "Recipient identity or DPNS name",
    ) as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "4" } });
    fireEvent.change(recipient, { target: { value: "alice.dash" } });
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        "DashMint tokens transferred successfully.",
      );
    });
    expect(amount.value).toBe("");
    expect(recipient.value).toBe("");
    expect(onTransferred).toHaveBeenCalledTimes(1);
  });

  it("clears a success notice across logout and login", async () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue(resolved(SAMPLE_ID));
    mockTransferDashMintTokens.mockResolvedValueOnce(undefined);

    const view = render(
      <TokenTransferScreen
        contractId="contract-1"
        dashMintTokenBalance={10n}
      />,
    );

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText("Recipient identity or DPNS name"), {
      target: { value: "alice.dash" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));

    await screen.findByRole("status");
    expect(screen.getByRole("status").textContent).toContain(
      "DashMint tokens transferred successfully.",
    );

    mockUseSession.mockReturnValue({
      ...sessionValue,
      status: "browsing",
      identityId: null,
      keyManager: null,
    });
    view.rerender(
      <TokenTransferScreen
        contractId="contract-1"
        dashMintTokenBalance={null}
      />,
    );
    expect(screen.queryByRole("status")).toBeNull();

    mockUseSession.mockReturnValue({
      ...sessionValue,
      identityId: "sender-2",
    });
    view.rerender(
      <TokenTransferScreen contractId="contract-1" dashMintTokenBalance={8n} />,
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows inline errors and preserves form values", async () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue(resolved(SAMPLE_ID));
    mockTransferDashMintTokens.mockRejectedValueOnce(
      new Error("Transfer failed"),
    );

    render(
      <TokenTransferScreen
        contractId="contract-1"
        dashMintTokenBalance={10n}
      />,
    );

    const amount = screen.getByLabelText("Amount") as HTMLInputElement;
    const recipient = screen.getByLabelText(
      "Recipient identity or DPNS name",
    ) as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "5" } });
    fireEvent.change(recipient, { target: { value: "alice.dash" } });
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Transfer failed");
    expect(amount.value).toBe("5");
    expect(recipient.value).toBe("alice.dash");
  });
});
