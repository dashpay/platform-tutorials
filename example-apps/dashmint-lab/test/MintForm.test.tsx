// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MintForm } from "../src/components/MintForm";
import type { DashKeyManager, DashSdk } from "../src/dash/types";

const {
  mockUseSession,
  mockMintCard,
  mockDrawStarterPack,
  mockFetchCardsMintedCount,
} = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockMintCard: vi.fn(),
  mockDrawStarterPack: vi.fn(),
  mockFetchCardsMintedCount: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/dash/mintCard", () => ({
  mintCard: mockMintCard,
}));

vi.mock("../src/dash/dashMintToken", async () => {
  const actual = await vi.importActual<
    typeof import("../src/dash/dashMintToken")
  >("../src/dash/dashMintToken");
  return {
    ...actual,
    fetchCardsMintedCount: mockFetchCardsMintedCount,
  };
});

vi.mock("../src/data/starterPack", () => ({
  STARTER_PACK_SIZE: 3,
  drawStarterPack: mockDrawStarterPack,
}));

import { STARTER_PACK_SIZE } from "../src/data/starterPack";

const sessionValue = {
  sdk: {} as DashSdk,
  keyManager: {} as DashKeyManager,
  log: vi.fn(),
};

const starterPackCards = [
  {
    name: "Stone Golem",
    description: "An ancient guardian carved from living rock",
  },
  {
    name: "Crystal Serpent",
    description: "A glittering wyrm with scales sharp as glass",
  },
  {
    name: "Sun Priestess",
    description: "A radiant caster who shields allies with solar fire",
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  // Test stub: a never-resolving promise so `mintedCount` stays at its
  // initial `null` (the "supply unknown" branch — full form visible, no
  // sold-out gating). Tests that need a concrete count override this with
  // `mockResolvedValueOnce(...)`.
  mockFetchCardsMintedCount.mockReturnValue(new Promise(() => {}));
});

describe("MintForm", () => {
  it("keeps submit disabled for an empty name and does not mint", () => {
    mockUseSession.mockReturnValue(sessionValue);

    render(<MintForm contractId="contract-1" onMinted={vi.fn()} />);

    const submit = screen.getByRole("button", {
      name: "Mint Card",
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("e.g. Fire Dragon"), {
      target: { value: "   " },
    });

    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(mockMintCard).not.toHaveBeenCalled();
  });

  it("mints a card, resets the fields, and notifies the parent", async () => {
    const onMinted = vi.fn();
    mockUseSession.mockReturnValue(sessionValue);
    mockMintCard.mockResolvedValueOnce(undefined);

    render(<MintForm contractId="contract-1" onMinted={onMinted} />);

    fireEvent.change(screen.getByPlaceholderText("e.g. Fire Dragon"), {
      target: { value: "Sky Hunter" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(
        "e.g. A legendary beast from the volcanic plains",
      ),
      {
        target: { value: "Fast and bright." },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Mint Card" }));

    await waitFor(() => {
      expect(mockMintCard).toHaveBeenCalledWith({
        sdk: sessionValue.sdk,
        keyManager: sessionValue.keyManager,
        contractId: "contract-1",
        card: {
          name: "Sky Hunter",
          description: "Fast and bright.",
        },
        log: sessionValue.log,
      });
    });

    expect(
      (screen.getByPlaceholderText("e.g. Fire Dragon") as HTMLInputElement)
        .value,
    ).toBe("");
    expect(
      (
        screen.getByPlaceholderText(
          "e.g. A legendary beast from the volcanic plains",
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("");
    expect(onMinted).toHaveBeenCalledTimes(1);
  });

  it("logs an error and does not notify the parent when minting fails", async () => {
    const onMinted = vi.fn();
    const log = vi.fn();
    mockUseSession.mockReturnValue({ ...sessionValue, log });
    mockMintCard.mockRejectedValueOnce(new Error("Mint failed"));

    render(<MintForm contractId="contract-1" onMinted={onMinted} />);

    fireEvent.change(screen.getByPlaceholderText("e.g. Fire Dragon"), {
      target: { value: "Sky Hunter" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mint Card" }));

    await waitFor(() => {
      expect(log).toHaveBeenCalledWith("Mint error: Mint failed", "error");
    });

    expect(onMinted).not.toHaveBeenCalled();
  });

  it("mints the starter pack and reports success once", async () => {
    const onMinted = vi.fn();
    const log = vi.fn();
    mockUseSession.mockReturnValue({ ...sessionValue, log });
    mockMintCard.mockResolvedValue(undefined);
    mockDrawStarterPack.mockReturnValue(starterPackCards);

    render(<MintForm contractId="contract-1" onMinted={onMinted} />);

    fireEvent.click(screen.getByRole("button", { name: "Open Starter Pack" }));

    await waitFor(() => {
      expect(mockMintCard).toHaveBeenCalledTimes(3);
    });

    expect(mockMintCard).toHaveBeenNthCalledWith(1, {
      sdk: sessionValue.sdk,
      keyManager: sessionValue.keyManager,
      contractId: "contract-1",
      card: starterPackCards[0],
      log,
    });
    expect(mockMintCard).toHaveBeenNthCalledWith(2, {
      sdk: sessionValue.sdk,
      keyManager: sessionValue.keyManager,
      contractId: "contract-1",
      card: starterPackCards[1],
      log,
    });
    expect(mockMintCard).toHaveBeenNthCalledWith(3, {
      sdk: sessionValue.sdk,
      keyManager: sessionValue.keyManager,
      contractId: "contract-1",
      card: starterPackCards[2],
      log,
    });
    expect(
      new Set(
        mockMintCard.mock.calls.map(
          ([args]) => (args as { card: { name: string } }).card.name,
        ),
      ).size,
    ).toBe(3);
    expect(log).toHaveBeenCalledWith(
      `Minting starter pack (${STARTER_PACK_SIZE} cards)…`,
    );
    expect(log).toHaveBeenCalledWith("Starter pack minted!", "success");
    expect(onMinted).toHaveBeenCalledTimes(1);
  });

  it("stops the starter pack success flow when one mint rejects mid-batch", async () => {
    const onMinted = vi.fn();
    const log = vi.fn();
    mockUseSession.mockReturnValue({ ...sessionValue, log });
    mockMintCard
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("second mint failed"));
    mockDrawStarterPack.mockReturnValue(starterPackCards);

    render(<MintForm contractId="contract-1" onMinted={onMinted} />);

    fireEvent.click(screen.getByRole("button", { name: "Open Starter Pack" }));

    await waitFor(() => {
      expect(mockMintCard).toHaveBeenCalledTimes(2);
    });

    expect(log).toHaveBeenCalledWith(
      `Minting starter pack (${STARTER_PACK_SIZE} cards)…`,
    );
    expect(log).toHaveBeenCalledWith(
      "Starter pack error: second mint failed",
      "error",
    );
    expect(log).not.toHaveBeenCalledWith("Starter pack minted!", "success");
    expect(onMinted).not.toHaveBeenCalled();
  });

  it("shows token-burn copy and disables minting when the token balance is zero", () => {
    mockUseSession.mockReturnValue(sessionValue);

    render(
      <MintForm
        contractId="contract-1"
        dashMintTokenBalance={0n}
        onMinted={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        /Mint a unique collectible card\. Costs 1 DashMint token\./,
      ),
    ).toBeTruthy();
    expect(screen.getByText("Your DashMint token balance")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    expect(
      screen.getByText("You need at least 1 DashMint token to mint a card."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        `You need ${STARTER_PACK_SIZE} DashMint tokens to open a Starter Pack.`,
      ),
    ).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("e.g. Fire Dragon"), {
      target: { value: "Sky Hunter" },
    });

    expect(
      (
        screen.getByRole("button", {
          name: "Mint Card",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(mockMintCard).not.toHaveBeenCalled();
  });

  it("allows a single mint but disables starter pack when balance is below pack size", () => {
    mockUseSession.mockReturnValue(sessionValue);

    render(
      <MintForm
        contractId="contract-1"
        dashMintTokenBalance={1n}
        onMinted={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("e.g. Fire Dragon"), {
      target: { value: "Sky Hunter" },
    });

    expect(
      (
        screen.getByRole("button", {
          name: "Mint Card",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      (
        screen.getByRole("button", {
          name: "Open Starter Pack",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.getByText(
        `You need ${STARTER_PACK_SIZE} DashMint tokens to open a Starter Pack.`,
      ),
    ).toBeTruthy();
  });

  it("shows the supply count and progress once the minted count loads", async () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockFetchCardsMintedCount.mockResolvedValueOnce(42n);

    render(
      <MintForm
        contractId="contract-1"
        dashMintTokenBalance={5n}
        onMinted={vi.fn()}
      />,
    );

    expect(await screen.findByText("42 / 100 minted")).toBeTruthy();
    // Mint form still rendered while supply remains.
    expect(screen.getByRole("button", { name: "Mint Card" })).toBeTruthy();
  });

  it("collapses to the supply notice and hides the form when sold out", async () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockFetchCardsMintedCount.mockResolvedValueOnce(100n);

    render(
      <MintForm
        contractId="contract-1"
        dashMintTokenBalance={0n}
        onMinted={vi.fn()}
      />,
    );

    expect(await screen.findByText("100 / 100 minted")).toBeTruthy();
    expect(screen.getByText("All cards have been minted.")).toBeTruthy();

    // Form, token-balance block, and both mint buttons should be gone.
    expect(screen.queryByRole("button", { name: "Mint Card" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Open Starter Pack" }),
    ).toBeNull();
    expect(screen.queryByPlaceholderText("e.g. Fire Dragon")).toBeNull();
    expect(screen.queryByText("Your DashMint token balance")).toBeNull();
    expect(
      screen.queryByText("You need at least 1 DashMint token to mint a card."),
    ).toBeNull();
  });

  it("disables the starter pack when fewer than pack-size mints remain", async () => {
    mockUseSession.mockReturnValue(sessionValue);
    // 2 mints left, pack size is 3.
    mockFetchCardsMintedCount.mockResolvedValueOnce(98n);

    render(
      <MintForm
        contractId="contract-1"
        dashMintTokenBalance={10n}
        onMinted={vi.fn()}
      />,
    );

    expect(await screen.findByText("98 / 100 minted")).toBeTruthy();
    expect(
      screen.getByText("Not enough remaining supply for a Starter Pack."),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Sold out",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    // Single-card mint is still available once the name is filled in.
    fireEvent.change(screen.getByPlaceholderText("e.g. Fire Dragon"), {
      target: { value: "Sky Hunter" },
    });
    expect(
      (
        screen.getByRole("button", {
          name: "Mint Card",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});
