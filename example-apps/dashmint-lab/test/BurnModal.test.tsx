// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BurnModal } from "../src/components/BurnModal";
import type { Card } from "../src/dash/queries";
import type { DashKeyManager, DashSdk } from "../src/dash/types";

const { mockUseSession, mockBurnCard } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockBurnCard: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/dash/burnCard", () => ({
  burnCard: mockBurnCard,
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

describe("BurnModal", () => {
  it("requires a confirmation click before burning", () => {
    mockUseSession.mockReturnValue(sessionValue);

    render(<BurnModal card={card} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Burn Card" }));

    expect(mockBurnCard).not.toHaveBeenCalled();
    expect(screen.getByText("Are you sure? This action is permanent.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm Burn" })).toBeTruthy();
  });

  it("shows an inline error and stays open when burn fails", async () => {
    const onClose = vi.fn();
    mockUseSession.mockReturnValue(sessionValue);
    mockBurnCard.mockRejectedValueOnce(new Error("Burn failed"));

    render(<BurnModal card={card} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Burn Card" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm Burn" }));
    });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Burn failed");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows inline success before closing", async () => {
    const onClose = vi.fn();
    const onBurned = vi.fn();
    vi.useFakeTimers();
    mockUseSession.mockReturnValue(sessionValue);
    mockBurnCard.mockResolvedValueOnce(undefined);

    render(<BurnModal card={card} onClose={onClose} onBurned={onBurned} />);

    fireEvent.click(screen.getByRole("button", { name: "Burn Card" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Burn" }));

    expect(mockBurnCard).toHaveBeenCalledWith({
      sdk: sessionValue.sdk,
      keyManager: sessionValue.keyManager,
      contractId: "contract-1",
      cardId: "card-1",
      log: sessionValue.log,
    });

    await settle();
    expect(screen.getByRole("status").textContent).toContain(
      "Card burned successfully.",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    expect(onBurned).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
