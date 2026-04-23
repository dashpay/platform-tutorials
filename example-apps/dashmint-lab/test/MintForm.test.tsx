// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MintForm } from "../src/components/MintForm";
import type { DashKeyManager, DashSdk } from "../src/dash/types";

const { mockUseSession, mockMintCard, mockDrawStarterPack } = vi.hoisted(
  () => ({
    mockUseSession: vi.fn(),
    mockMintCard: vi.fn(),
    mockDrawStarterPack: vi.fn(),
  }),
);

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/dash/mintCard", () => ({
  mintCard: mockMintCard,
}));

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

describe("MintForm", () => {
  it("keeps submit disabled for an empty name and does not mint", () => {
    mockUseSession.mockReturnValue(sessionValue);

    render(<MintForm contractId="contract-1" onMinted={vi.fn()} />);

    const submit = screen.getByRole("button", {
      name: "Mint card",
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
    fireEvent.click(screen.getByRole("button", { name: "Mint card" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Mint card" }));

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

    fireEvent.click(screen.getByRole("button", { name: "Mint Starter Pack" }));

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

    fireEvent.click(screen.getByRole("button", { name: "Mint Starter Pack" }));

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
});
