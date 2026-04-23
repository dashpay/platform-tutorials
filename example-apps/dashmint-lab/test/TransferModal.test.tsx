// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TransferModal } from "../src/components/TransferModal";
import type { Card } from "../src/dash/queries";
import type { DashKeyManager, DashSdk } from "../src/dash/types";

const { mockUseSession, mockTransferCard, mockUseDpnsName } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockTransferCard: vi.fn(),
  mockUseDpnsName: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/dash/transferCard", () => ({
  transferCard: mockTransferCard,
}));

vi.mock("../src/hooks/useDpnsName", () => ({
  useDpnsName: mockUseDpnsName,
}));

const card: Card = {
  id: "card-1",
  ownerId: "owner-1",
  data: {
    name: "Fire Dragon",
    attack: 9,
    defense: 8,
  },
};

const sessionValue = {
  sdk: {} as DashSdk,
  keyManager: {} as DashKeyManager,
  contractId: "contract-1",
  log: vi.fn(),
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function settle() {
  await act(async () => {
    await flushPromises();
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("TransferModal", () => {
  it("shows an inline error and stays open when transfer fails", async () => {
    const onClose = vi.fn();
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockTransferCard.mockRejectedValueOnce(new Error("Transfer failed"));

    render(<TransferModal card={card} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Recipient identity ID"), {
      target: { value: "recipient-id" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Transfer" }));
    });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Transfer failed");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows inline success before closing", async () => {
    const onClose = vi.fn();
    const onTransferred = vi.fn();
    vi.useFakeTimers();
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue("alice");
    mockTransferCard.mockResolvedValueOnce(undefined);

    render(
      <TransferModal
        card={card}
        onClose={onClose}
        onTransferred={onTransferred}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Identity ID of the recipient"), {
      target: { value: "  recipient-id-12345678901234567890123456789012  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));

    expect(mockTransferCard).toHaveBeenCalledWith({
      sdk: sessionValue.sdk,
      keyManager: sessionValue.keyManager,
      contractId: "contract-1",
      cardId: "card-1",
      recipientId: "recipient-id-12345678901234567890123456789012",
      log: sessionValue.log,
    });

    await settle();
    expect(screen.getByRole("status").textContent).toContain(
      "Card transferred successfully.",
    );

    expect(onTransferred).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    expect(onTransferred).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("skips DPNS lookup when the trimmed recipient is shorter than 32 chars", () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);

    render(<TransferModal card={card} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Recipient identity ID"), {
      target: { value: "  short-id  " },
    });

    expect(mockUseDpnsName).toHaveBeenLastCalledWith(sessionValue.sdk, null);
  });

  it("passes the trimmed recipient into DPNS lookup at 32 chars or more", () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);

    render(<TransferModal card={card} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Recipient identity ID"), {
      target: { value: "  12345678901234567890123456789012  " },
    });

    expect(mockUseDpnsName).toHaveBeenLastCalledWith(
      sessionValue.sdk,
      "12345678901234567890123456789012",
    );
  });

  it("renders a resolved DPNS name in the helper and transfer summary", () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue("alice");

    render(<TransferModal card={card} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Identity ID of the recipient"), {
      target: { value: "12345678901234567890123456789012" },
    });

    expect(screen.getByText("✓ alice.dash")).toBeTruthy();
    expect(screen.getByText(/Transferring/).textContent).toContain("alice.dash");
    expect(screen.getByText(/Transferring/).textContent).toContain("…");
  });

  it("closes when cancel is clicked", () => {
    const onClose = vi.fn();
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);

    render(<TransferModal card={card} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables controls and shows the in-flight label while submitting", async () => {
    const transfer = deferred<void>();
    mockUseSession.mockReturnValue(sessionValue);
    mockUseDpnsName.mockReturnValue(null);
    mockTransferCard.mockReturnValueOnce(transfer.promise);

    render(<TransferModal card={card} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Recipient identity ID"), {
      target: { value: "recipient-id-12345678901234567890123456789012" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Transfer" }));
    });

    await settle();
    expect(
      (screen.getByRole("button", { name: "Transferring…" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await act(async () => {
      transfer.resolve();
      await transfer.promise;
    });
    await settle();
    expect(screen.getByRole("status").textContent).toContain(
      "Card transferred successfully.",
    );
  });
});
