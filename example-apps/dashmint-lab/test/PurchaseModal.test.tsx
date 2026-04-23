// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
  log: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("PurchaseModal", () => {
  it("shows an inline error and stays open when purchase fails", async () => {
    const onClose = vi.fn();
    mockUseSession.mockReturnValue(sessionValue);
    mockPurchaseCard.mockRejectedValueOnce(new Error("Purchase failed"));

    render(<PurchaseModal card={card} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Buy" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Purchase failed");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows inline success before closing", async () => {
    const onClose = vi.fn();
    const onPurchased = vi.fn();
    mockUseSession.mockReturnValue(sessionValue);
    mockPurchaseCard.mockResolvedValueOnce(undefined);

    render(
      <PurchaseModal card={card} onClose={onClose} onPurchased={onPurchased} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Buy" }));

    expect(mockPurchaseCard).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByText("Card purchased successfully.")).toBeTruthy();
    });
    expect(onClose).not.toHaveBeenCalled();
    await new Promise((resolve) => window.setTimeout(resolve, 750));

    expect(onPurchased).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
