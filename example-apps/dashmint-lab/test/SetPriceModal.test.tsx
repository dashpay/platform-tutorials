// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SetPriceModal } from "../src/components/SetPriceModal";
import type { Card } from "../src/dash/queries";
import type { DashKeyManager, DashSdk } from "../src/dash/types";

const { mockUseSession, mockSetPrice } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockSetPrice: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/dash/setPrice", () => ({
  setPrice: mockSetPrice,
}));

const listedCard: Card = {
  id: "card-1",
  ownerId: "owner-1",
  data: {
    name: "Fire Dragon",
    attack: 9,
    defense: 8,
  },
  $price: 25n,
};

const unlistedCard: Card = {
  ...listedCard,
  $price: undefined,
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

describe("SetPriceModal", () => {
  it("shows an inline error and stays open when price update fails", async () => {
    const onClose = vi.fn();
    mockUseSession.mockReturnValue(sessionValue);
    mockSetPrice.mockRejectedValueOnce(new Error("Set price failed"));

    render(<SetPriceModal card={unlistedCard} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Price"), {
      target: { value: "42" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "List for sale" }));
    });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Set price failed");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows inline success before closing after setting a price", async () => {
    const onClose = vi.fn();
    const onPriced = vi.fn();
    vi.useFakeTimers();
    mockUseSession.mockReturnValue(sessionValue);
    mockSetPrice.mockResolvedValueOnce(undefined);

    render(
      <SetPriceModal
        card={unlistedCard}
        onClose={onClose}
        onPriced={onPriced}
      />,
    );

    fireEvent.change(screen.getByLabelText("Price"), {
      target: { value: "42" },
    });
    fireEvent.click(screen.getByRole("button", { name: "List for sale" }));

    expect(mockSetPrice).toHaveBeenCalledWith({
      sdk: sessionValue.sdk,
      keyManager: sessionValue.keyManager,
      contractId: "contract-1",
      cardId: "card-1",
      price: 42,
      log: sessionValue.log,
    });

    await settle();
    expect(screen.getByRole("status").textContent).toContain(
      "Price updated successfully.",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    expect(onPriced).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("removes a card from sale and closes after success", async () => {
    const onClose = vi.fn();
    const onPriced = vi.fn();
    vi.useFakeTimers();
    mockUseSession.mockReturnValue(sessionValue);
    mockSetPrice.mockResolvedValueOnce(undefined);

    render(
      <SetPriceModal card={listedCard} onClose={onClose} onPriced={onPriced} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove from sale" }));
    });

    expect(mockSetPrice).toHaveBeenCalledWith({
      sdk: sessionValue.sdk,
      keyManager: sessionValue.keyManager,
      contractId: "contract-1",
      cardId: "card-1",
      price: 0,
      log: sessionValue.log,
    });

    await settle();
    expect(screen.getByRole("status").textContent).toContain(
      "Card removed from sale.",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    expect(onPriced).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
