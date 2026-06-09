// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "../src/components/AppShell";
import { CardGrid } from "../src/components/CardGrid";
import { HowItWorks } from "../src/components/HowItWorks";
import { SubTabs } from "../src/components/Tabs";
import type { Card } from "../src/dash/queries";

const { mockUseDpnsName } = vi.hoisted(() => ({
  mockUseDpnsName: vi.fn(),
}));

vi.mock("../src/hooks/useDpnsName", () => ({
  useDpnsName: mockUseDpnsName,
}));

vi.mock("../src/components/CardTile", () => ({
  CardTile: ({
    card,
    onTransfer,
  }: {
    card: Card;
    onTransfer?: (card: Card) => void;
  }) => (
    <article>
      <h3>{card.data.name}</h3>
      <button type="button" onClick={() => onTransfer?.(card)}>
        Transfer {card.id}
      </button>
    </article>
  ),
}));

const cards: Card[] = [
  {
    id: "card-1",
    ownerId: "owner-1",
    data: { name: "Fire Dragon", attack: 9, defense: 8 },
  },
  {
    id: "card-2",
    ownerId: "owner-2",
    data: { name: "Aqua Spirit", attack: 3, defense: 4 },
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AppShell", () => {
  it("shows sidebar login navigation when the session is not authenticated", () => {
    const onLoginOpen = vi.fn();

    render(
      <AppShell
        tab="collection"
        onTabChange={vi.fn()}
        status="browsing"
        identityId={null}
        sdk={null}
        onLoginOpen={onLoginOpen}
      >
        <div>Collection content</div>
      </AppShell>,
    );

    const sidebar = screen.getByRole("complementary", {
      name: "Main navigation",
    });
    fireEvent.click(within(sidebar).getByRole("button", { name: /Login/ }));

    expect(onLoginOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Collection content")).toBeTruthy();
  });

  it("closes the mobile drawer after selecting a navigation item", () => {
    const onTabChange = vi.fn();

    render(
      <AppShell
        tab="collection"
        onTabChange={onTabChange}
        status="browsing"
        identityId={null}
        sdk={null}
        onLoginOpen={vi.fn()}
      >
        <div>Collection content</div>
      </AppShell>,
    );

    const menuButton = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(menuButton);
    expect(menuButton.getAttribute("aria-expanded")).toBe("true");

    const sidebar = screen.getByRole("complementary", {
      name: "Main navigation",
    });
    fireEvent.click(within(sidebar).getByRole("button", { name: /Mint/ }));

    expect(onTabChange).toHaveBeenCalledWith("mint");
    expect(menuButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("hides login navigation and shows identity details when authenticated", () => {
    mockUseDpnsName.mockReturnValue("alice");

    render(
      <AppShell
        tab="collection"
        onTabChange={vi.fn()}
        status="authenticated"
        identityId="identity-1234567890"
        sdk={{} as never}
        onLoginOpen={vi.fn()}
      >
        <div>Collection content</div>
      </AppShell>,
    );

    const sidebar = screen.getByRole("complementary", {
      name: "Main navigation",
    });
    expect(within(sidebar).queryByRole("button", { name: /Login/ })).toBeNull();
    expect(screen.getByText("Signed in")).toBeTruthy();
    expect(screen.getByText("@alice")).toBeTruthy();
  });
});

describe("SubTabs", () => {
  it("hides the Yours tab for browse-only users", () => {
    render(<SubTabs value="all" onChange={vi.fn()} showMy={false} />);

    expect(screen.queryByRole("button", { name: "Yours" })).toBeNull();
    expect(screen.getByRole("button", { name: "All" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Marketplace" })).toBeTruthy();
  });

  it("emits tab changes for visible collection tabs", () => {
    const onChange = vi.fn();
    render(<SubTabs value="my" onChange={onChange} showMy />);

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.click(screen.getByRole("button", { name: "Marketplace" }));
    fireEvent.click(screen.getByRole("button", { name: "Yours" }));

    expect(onChange).toHaveBeenNthCalledWith(1, "all");
    expect(onChange).toHaveBeenNthCalledWith(2, "marketplace");
    expect(onChange).toHaveBeenNthCalledWith(3, "my");
  });
});

describe("CardGrid", () => {
  it("renders the configured empty message when there are no cards", () => {
    render(
      <CardGrid
        cards={[]}
        currentIdentityId={null}
        emptyMessage="Nothing minted yet."
      />,
    );

    expect(screen.getByText("Nothing minted yet.")).toBeTruthy();
  });

  it("renders one CardTile per card and forwards callbacks", () => {
    const onTransfer = vi.fn();

    render(
      <CardGrid
        cards={cards}
        currentIdentityId="owner-1"
        onTransfer={onTransfer}
      />,
    );

    expect(screen.getByText("Fire Dragon")).toBeTruthy();
    expect(screen.getByText("Aqua Spirit")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Transfer card-2" }));

    expect(onTransfer).toHaveBeenCalledWith(cards[1]);
  });
});

describe("HowItWorks", () => {
  it("maps the mint operation to the token-paid document create call", () => {
    render(<HowItWorks />);

    expect(screen.getByText("Platform operations at a glance")).toBeTruthy();
    expect(screen.getByText("Mint card")).toBeTruthy();
    expect(
      screen.getByText("sdk.documents.create + tokenPaymentInfo"),
    ).toBeTruthy();
  });
});
