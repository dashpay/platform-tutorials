// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CardTile } from "../src/components/CardTile";
import type { Card } from "../src/dash/queries";
import type { DashSdk } from "../src/dash/types";

const { mockUseDpnsName, mockWriteText, mockWindowOpen } = vi.hoisted(() => ({
  mockUseDpnsName: vi.fn(),
  mockWriteText: vi.fn(),
  mockWindowOpen: vi.fn(),
}));

vi.mock("../src/hooks/useDpnsName", () => ({
  useDpnsName: mockUseDpnsName,
}));

const card: Card = {
  id: "card-1",
  ownerId: "owner-1234567890abcdef",
  data: {
    name: "Fire Dragon",
    description: "A legendary beast from the volcanic plains",
    attack: 9,
    defense: 8,
  },
};

const sdk = {} as DashSdk;
let clipboardDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  mockUseDpnsName.mockReset();
  mockUseDpnsName.mockReturnValue(null);
  mockWriteText.mockReset();
  mockWindowOpen.mockReset();
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: mockWriteText,
    },
  });
  vi.stubGlobal("open", mockWindowOpen);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  if (clipboardDescriptor) {
    Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  } else {
    delete (navigator as Navigator & { clipboard?: Clipboard }).clipboard;
  }
});

describe("CardTile", () => {
  it("shows owner actions for an unlisted owner card", () => {
    const onSetPrice = vi.fn();

    render(
      <CardTile
        card={card}
        currentIdentityId="owner-1234567890abcdef"
        sdk={sdk}
        onSetPrice={onSetPrice}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sell" }));

    expect(onSetPrice).toHaveBeenCalledWith(card);
    expect(screen.queryByRole("button", { name: "Buy" })).toBeNull();
  });

  it("shows edit-price and owner overflow actions for a listed owner card", () => {
    const onSetPrice = vi.fn();
    const onTransfer = vi.fn();
    const onBurn = vi.fn();

    render(
      <CardTile
        card={{ ...card, $price: 25n }}
        currentIdentityId="owner-1234567890abcdef"
        sdk={sdk}
        onSetPrice={onSetPrice}
        onTransfer={onTransfer}
        onBurn={onBurn}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit price" }));
    expect(onSetPrice).toHaveBeenCalledWith({ ...card, $price: 25n });

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));
    expect(onTransfer).toHaveBeenCalledWith({ ...card, $price: 25n });

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Burn Card" }));
    expect(onBurn).toHaveBeenCalledWith({ ...card, $price: 25n });
  });

  it("lets an authenticated non-owner buy a listed card", () => {
    const onPurchase = vi.fn();
    const pricedCard = { ...card, $price: 25n };

    render(
      <CardTile
        card={pricedCard}
        currentIdentityId="buyer-1"
        sdk={sdk}
        onPurchase={onPurchase}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Buy" }));

    expect(onPurchase).toHaveBeenCalledWith(pricedCard);
  });

  it("does not show owner-only overflow actions for a non-owner", () => {
    render(
      <CardTile
        card={{ ...card, $price: 25n }}
        currentIdentityId="buyer-1"
        sdk={sdk}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));

    expect(screen.queryByRole("button", { name: "Transfer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Burn Card" })).toBeNull();
    expect(screen.getByRole("button", { name: "Copy ID" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View on Explorer" })).toBeTruthy();
  });

  it("prompts login for a browse-only buyer on listed cards", () => {
    const onLoginPrompt = vi.fn();

    render(
      <CardTile
        card={{ ...card, $price: 25n }}
        currentIdentityId={null}
        sdk={sdk}
        onLoginPrompt={onLoginPrompt}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Buy" }));

    expect(onLoginPrompt).toHaveBeenCalledTimes(1);
  });

  it("renders the DPNS owner name when available and falls back to a truncated id otherwise", () => {
    mockUseDpnsName.mockReturnValueOnce("alice").mockReturnValueOnce(null);

    const { rerender } = render(
      <CardTile card={card} currentIdentityId={null} sdk={sdk} />,
    );

    expect(screen.getByText("@alice")).toBeTruthy();

    rerender(<CardTile card={card} currentIdentityId={null} sdk={sdk} />);

    expect(screen.getByText("owner-…abcdef")).toBeTruthy();
  });

  it("copies the card id and opens the explorer from the overflow menu", () => {
    render(<CardTile card={card} currentIdentityId={null} sdk={sdk} />);

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy ID" }));
    expect(mockWriteText).toHaveBeenCalledWith("card-1");

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("button", { name: "View on Explorer" }));
    expect(mockWindowOpen).toHaveBeenCalledWith(
      "https://testnet.platform-explorer.com/document/card-1",
      "_blank",
    );
  });
});
