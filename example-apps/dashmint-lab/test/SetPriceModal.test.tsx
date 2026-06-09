// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MAX_PRICE_CREDITS,
  SetPriceModal,
} from "../src/components/SetPriceModal";
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
      price: 42n,
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

  it("sets a maximum price and blocks larger values", async () => {
    mockUseSession.mockReturnValue(sessionValue);

    render(<SetPriceModal card={unlistedCard} onClose={vi.fn()} />);

    const priceInput = screen.getByLabelText("Price");
    expect(priceInput.getAttribute("max")).toBe(String(MAX_PRICE_CREDITS));

    fireEvent.change(priceInput, {
      target: { value: String(MAX_PRICE_CREDITS + 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: "List for sale" }));

    expect(mockSetPrice).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "Price must be between 1 and 1,000,000,000,000,000 credits.",
    );
  });

  it("submits the maximum accepted price as an exact bigint", async () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockSetPrice.mockResolvedValueOnce(undefined);

    render(<SetPriceModal card={unlistedCard} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Price"), {
      target: { value: String(MAX_PRICE_CREDITS) },
    });
    fireEvent.click(screen.getByRole("button", { name: "List for sale" }));

    expect(mockSetPrice).toHaveBeenCalledWith(
      expect.objectContaining({
        price: BigInt(MAX_PRICE_CREDITS),
      }),
    );
  });

  it("treats $price === 0n as unlisted (zero is not a valid price)", () => {
    mockUseSession.mockReturnValue(sessionValue);

    render(
      <SetPriceModal card={{ ...listedCard, $price: 0n }} onClose={vi.fn()} />,
    );

    // Modal renders the unlisted variant: "Set price" title, no "Currently
    // listed at …" anchor, no "Remove from sale" button, and the submit
    // button reads "List for sale" (not "Update price").
    expect(screen.getByRole("heading", { name: "Set price" })).toBeTruthy();
    expect(screen.queryByText(/currently listed at/i)).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Remove from sale" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "List for sale" })).toBeTruthy();
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
