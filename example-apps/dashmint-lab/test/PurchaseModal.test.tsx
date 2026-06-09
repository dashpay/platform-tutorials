// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Card } from "../src/dash/queries";
import type { DashKeyManager, DashSdk } from "../src/dash/types";
import { PurchaseModal } from "../src/components/PurchaseModal";

const { mockUseSession, mockPurchaseCard } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockPurchaseCard: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/dash/purchaseCard", () => ({
  purchaseCard: mockPurchaseCard,
}));

const card: Card = {
  id: "card-1",
  ownerId: "owner-1",
  data: {
    name: "Fire Dragon",
    attack: 9,
    defense: 8,
  },
  $price: 25n,
};

const sessionValue = {
  sdk: {} as DashSdk,
  keyManager: {} as DashKeyManager,
  contractId: "contract-1",
  balance: null as bigint | null,
  log: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function settle() {
  await act(async () => {
    await flushPromises();
  });
}

describe("PurchaseModal", () => {
  it("shows an inline error and stays open when purchase fails", async () => {
    const onClose = vi.fn();
    mockUseSession.mockReturnValue(sessionValue);
    mockPurchaseCard.mockRejectedValueOnce(new Error("Purchase failed"));

    render(<PurchaseModal card={card} onClose={onClose} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Purchase failed");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows inline success before closing", async () => {
    const onClose = vi.fn();
    const onPurchased = vi.fn();
    vi.useFakeTimers();
    mockUseSession.mockReturnValue(sessionValue);
    mockPurchaseCard.mockResolvedValueOnce(undefined);

    render(
      <PurchaseModal card={card} onClose={onClose} onPurchased={onPurchased} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Buy" }));

    expect(mockPurchaseCard).toHaveBeenCalledWith({
      sdk: sessionValue.sdk,
      keyManager: sessionValue.keyManager,
      contractId: "contract-1",
      cardId: "card-1",
      price: 25n,
      log: sessionValue.log,
    });
    await settle();
    expect(screen.getByText("Card purchased successfully.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    expect(onPurchased).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables Buy and warns when balance is below the price", () => {
    mockUseSession.mockReturnValue({ ...sessionValue, balance: 10n });

    render(<PurchaseModal card={card} onClose={vi.fn()} />);

    const buyButton = screen.getByRole("button", {
      name: "Insufficient credits",
    });
    expect(buyButton.hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByText("Not enough credits to buy this card."),
    ).toBeTruthy();

    fireEvent.click(buyButton);
    expect(mockPurchaseCard).not.toHaveBeenCalled();
  });

  it("enables Buy with no warning when balance covers the price", () => {
    mockUseSession.mockReturnValue({ ...sessionValue, balance: 25n });

    render(<PurchaseModal card={card} onClose={vi.fn()} />);

    const buyButton = screen.getByRole("button", { name: "Buy" });
    expect(buyButton.hasAttribute("disabled")).toBe(false);
    expect(
      screen.queryByText("Not enough credits to buy this card."),
    ).toBeNull();
  });

  it("does not warn while the balance is still loading (null)", () => {
    mockUseSession.mockReturnValue({ ...sessionValue, balance: null });

    render(<PurchaseModal card={card} onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Buy" })).toBeTruthy();
    expect(
      screen.queryByText("Not enough credits to buy this card."),
    ).toBeNull();
  });
});
