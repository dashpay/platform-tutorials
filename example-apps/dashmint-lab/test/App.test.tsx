// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../src/App";
import type { Card } from "../src/dash/queries";
import type { LoginModalProps } from "../src/components/LoginModal";
import type { TransferModalProps } from "../src/components/TransferModal";
import type { SetPriceModalProps } from "../src/components/SetPriceModal";
import type { PurchaseModalProps } from "../src/components/PurchaseModal";
import type { BurnModalProps } from "../src/components/BurnModal";

const {
  mockUseSession,
  mockListAllCards,
  mockListMyCards,
  mockListMarketplaceCards,
} = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockListAllCards: vi.fn(),
  mockListMyCards: vi.fn(),
  mockListMarketplaceCards: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/dash/queries", () => ({
  listAllCards: mockListAllCards,
  listMyCards: mockListMyCards,
  listMarketplaceCards: mockListMarketplaceCards,
}));

vi.mock("sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

vi.mock("../src/components/AppShell", () => ({
  AppShell: ({
    children,
    onLoginOpen,
    onTabChange,
  }: {
    children: React.ReactNode;
    onLoginOpen: () => void;
    onTabChange: (tab: "collection" | "mint" | "how-it-works") => void;
  }) => (
    <div>
      <button type="button" onClick={onLoginOpen}>
        Open Login
      </button>
      <button type="button" onClick={() => onTabChange("collection")}>
        Collection Tab
      </button>
      <button type="button" onClick={() => onTabChange("mint")}>
        Mint Tab
      </button>
      <button type="button" onClick={() => onTabChange("how-it-works")}>
        How Tab
      </button>
      {children}
    </div>
  ),
}));

vi.mock("../src/components/Tabs", () => ({
  SubTabs: ({
    onChange,
    showMy,
  }: {
    onChange: (tab: "my" | "all" | "marketplace") => void;
    showMy: boolean;
  }) => (
    <div>
      {showMy && (
        <button type="button" onClick={() => onChange("my")}>
          Yours
        </button>
      )}
      <button type="button" onClick={() => onChange("all")}>
        All
      </button>
      <button type="button" onClick={() => onChange("marketplace")}>
        Marketplace
      </button>
    </div>
  ),
}));

vi.mock("../src/components/CollectionToolbar", () => ({
  CollectionToolbar: ({
    sortLabel,
    onSortClick,
  }: {
    sortLabel: string;
    onSortClick: () => void;
  }) => (
    <button type="button" onClick={onSortClick}>
      Sort: {sortLabel}
    </button>
  ),
}));

vi.mock("../src/components/CardGrid", () => ({
  CardGrid: ({
    cards,
    emptyMessage,
    onTransfer,
    onSetPrice,
    onPurchase,
    onBurn,
    onLoginPrompt,
  }: {
    cards: Card[];
    emptyMessage?: string;
    onTransfer?: (card: Card) => void;
    onSetPrice?: (card: Card) => void;
    onPurchase?: (card: Card) => void;
    onBurn?: (card: Card) => void;
    onLoginPrompt?: () => void;
  }) =>
    cards.length ? (
      <div>
        <div data-testid="cards">
          {cards.map((card) => card.data.name).join("|")}
        </div>
        <button type="button" onClick={() => onTransfer?.(cards[0])}>
          Transfer First Card
        </button>
        <button type="button" onClick={() => onSetPrice?.(cards[0])}>
          Price First Card
        </button>
        <button type="button" onClick={() => onPurchase?.(cards[0])}>
          Purchase First Card
        </button>
        <button type="button" onClick={() => onBurn?.(cards[0])}>
          Burn First Card
        </button>
        <button type="button" onClick={() => onLoginPrompt?.()}>
          Prompt Login
        </button>
      </div>
    ) : (
      <div data-testid="empty">{emptyMessage}</div>
    ),
}));

vi.mock("../src/components/LoginModal", () => ({
  LoginModal: ({ open }: LoginModalProps) => (
    <div data-testid="login-modal">open:{String(open)}</div>
  ),
}));

vi.mock("../src/components/TransferModal", () => ({
  TransferModal: ({ card, onTransferred }: TransferModalProps) => (
    <div data-testid="transfer-modal">
      card:{card?.id ?? "none"}
      <button type="button" onClick={() => onTransferred?.()}>
        Trigger Transfer Refresh
      </button>
    </div>
  ),
}));

vi.mock("../src/components/SetPriceModal", () => ({
  SetPriceModal: ({ card, onPriced }: SetPriceModalProps) => (
    <div data-testid="set-price-modal">
      card:{card?.id ?? "none"}
      <button type="button" onClick={() => onPriced?.()}>
        Trigger Price Refresh
      </button>
    </div>
  ),
}));

vi.mock("../src/components/PurchaseModal", () => ({
  PurchaseModal: ({ card, onPurchased }: PurchaseModalProps) => (
    <div data-testid="purchase-modal">
      card:{card?.id ?? "none"}
      <button type="button" onClick={() => onPurchased?.()}>
        Trigger Purchase Refresh
      </button>
    </div>
  ),
}));

vi.mock("../src/components/BurnModal", () => ({
  BurnModal: ({ card, onBurned }: BurnModalProps) => (
    <div data-testid="burn-modal">
      card:{card?.id ?? "none"}
      <button type="button" onClick={() => onBurned?.()}>
        Trigger Burn Refresh
      </button>
    </div>
  ),
}));

vi.mock("../src/components/MintForm", () => ({
  MintForm: () => <div>Mint Form</div>,
}));

vi.mock("../src/components/HowItWorks", () => ({
  HowItWorks: () => <div>How It Works</div>,
}));

function makeSession(overrides: Partial<ReturnType<typeof makeSession>> = {}) {
  return {
    status: "browsing" as const,
    sdk: { sdk: "connected" },
    identityId: null as string | null,
    contractId: "contract-1",
    contractOwnerId: null as string | null,
    log: vi.fn(),
    browseOnly: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const cards: Card[] = [
  {
    id: "b",
    ownerId: "owner-2",
    data: { name: "Stone Golem", attack: 4, defense: 9 },
    $price: 5n,
  },
  {
    id: "a",
    ownerId: "owner-1",
    data: { name: "Fire Dragon", attack: 9, defense: 8 },
    $price: 25n,
  },
  {
    id: "c",
    ownerId: "owner-3",
    data: { name: "Aqua Spirit", attack: 3, defense: 4 },
  },
];

beforeEach(() => {
  mockListAllCards.mockReset();
  mockListMyCards.mockReset();
  mockListMarketplaceCards.mockReset();
  mockUseSession.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("App", () => {
  it("auto-enters browse-only mode from idle", async () => {
    const session = makeSession({ status: "idle" as const });
    mockUseSession.mockReturnValue(session);
    mockListAllCards.mockResolvedValue([]);

    render(<App />);

    await waitFor(() => {
      expect(session.browseOnly).toHaveBeenCalledTimes(1);
    });
  });

  it("loads all cards in browse mode and switches to marketplace queries", async () => {
    const session = makeSession();
    mockUseSession.mockReturnValue(session);
    mockListAllCards.mockResolvedValue(cards);
    mockListMarketplaceCards.mockResolvedValue([cards[0], cards[1]]);

    render(<App />);

    await waitFor(() => {
      expect(mockListAllCards).toHaveBeenCalledWith({
        sdk: session.sdk,
        contractId: "contract-1",
        log: session.log,
      });
    });
    expect(screen.getByTestId("cards").textContent).toBe(
      "Fire Dragon|Stone Golem|Aqua Spirit",
    );

    fireEvent.click(screen.getByRole("button", { name: "Marketplace" }));

    await waitFor(() => {
      expect(mockListMarketplaceCards).toHaveBeenCalledWith({
        sdk: session.sdk,
        contractId: "contract-1",
        log: session.log,
      });
    });
  });

  it("defaults to the signed-in collection and uses the owner-scoped query", async () => {
    const session = makeSession({
      status: "authenticated" as const,
      identityId: "identity-1",
    });
    mockUseSession.mockReturnValue(session);
    mockListMyCards.mockResolvedValue([cards[1]]);

    render(<App />);

    await waitFor(() => {
      expect(mockListMyCards).toHaveBeenCalledWith({
        sdk: session.sdk,
        contractId: "contract-1",
        identityId: "identity-1",
        log: session.log,
      });
    });

    expect(screen.getByTestId("cards").textContent).toBe("Fire Dragon");
  });

  it("logs query failures and clears the grid", async () => {
    const session = makeSession();
    mockUseSession.mockReturnValue(session);
    mockListAllCards.mockRejectedValue(new Error("query broke"));

    render(<App />);

    await waitFor(() => {
      expect(session.log).toHaveBeenCalledWith(
        "Query failed: query broke",
        "error",
      );
    });

    expect(screen.getByTestId("empty").textContent).toBe("No cards found.");
  });

  it("cycles sort order across rarity, name, owner, and price", async () => {
    const session = makeSession();
    mockUseSession.mockReturnValue(session);
    mockListAllCards.mockResolvedValue(cards);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("cards").textContent).toBe(
        "Fire Dragon|Stone Golem|Aqua Spirit",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Sort: Rarity" }));
    expect(screen.getByTestId("cards").textContent).toBe(
      "Aqua Spirit|Fire Dragon|Stone Golem",
    );

    fireEvent.click(screen.getByRole("button", { name: "Sort: Name" }));
    expect(screen.getByTestId("cards").textContent).toBe(
      "Fire Dragon|Stone Golem|Aqua Spirit",
    );

    fireEvent.click(screen.getByRole("button", { name: "Sort: Owner" }));
    expect(screen.getByTestId("cards").textContent).toBe(
      "Fire Dragon|Stone Golem|Aqua Spirit",
    );

    fireEvent.click(screen.getByRole("button", { name: "Sort: Price" }));
    expect(screen.getByTestId("cards").textContent).toBe(
      "Fire Dragon|Stone Golem|Aqua Spirit",
    );
  });

  it("wires modal state into child props for login and card actions", async () => {
    const session = makeSession();
    mockUseSession.mockReturnValue(session);
    mockListAllCards.mockResolvedValue(cards);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("cards").textContent).toBe(
        "Fire Dragon|Stone Golem|Aqua Spirit",
      );
    });

    expect(screen.getByTestId("login-modal").textContent).toContain(
      "open:false",
    );
    expect(screen.getByTestId("transfer-modal").textContent).toContain(
      "card:none",
    );
    expect(screen.getByTestId("set-price-modal").textContent).toContain(
      "card:none",
    );
    expect(screen.getByTestId("purchase-modal").textContent).toContain(
      "card:none",
    );
    expect(screen.getByTestId("burn-modal").textContent).toContain("card:none");

    fireEvent.click(screen.getByRole("button", { name: "Open Login" }));
    expect(screen.getByTestId("login-modal").textContent).toContain(
      "open:true",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Transfer First Card" }),
    );
    expect(screen.getByTestId("transfer-modal").textContent).toContain(
      "card:a",
    );

    fireEvent.click(screen.getByRole("button", { name: "Price First Card" }));
    expect(screen.getByTestId("set-price-modal").textContent).toContain(
      "card:a",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Purchase First Card" }),
    );
    expect(screen.getByTestId("purchase-modal").textContent).toContain(
      "card:a",
    );

    fireEvent.click(screen.getByRole("button", { name: "Burn First Card" }));
    expect(screen.getByTestId("burn-modal").textContent).toContain("card:a");
  });

  it("refreshes card queries after child mutation callbacks fire", async () => {
    const session = makeSession();
    mockUseSession.mockReturnValue(session);
    mockListAllCards.mockResolvedValue(cards);

    render(<App />);

    await screen.findByRole("button", { name: "Transfer First Card" });

    fireEvent.click(
      screen.getByRole("button", { name: "Transfer First Card" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Trigger Transfer Refresh" }),
    );

    await waitFor(() => {
      expect(mockListAllCards).toHaveBeenCalledTimes(2);
    });
    await screen.findByRole("button", { name: "Price First Card" });

    fireEvent.click(screen.getByRole("button", { name: "Price First Card" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Trigger Price Refresh" }),
    );

    await waitFor(() => {
      expect(mockListAllCards).toHaveBeenCalledTimes(3);
    });
    await screen.findByRole("button", { name: "Purchase First Card" });

    fireEvent.click(
      screen.getByRole("button", { name: "Purchase First Card" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Trigger Purchase Refresh" }),
    );

    await waitFor(() => {
      expect(mockListAllCards).toHaveBeenCalledTimes(4);
    });
    await screen.findByRole("button", { name: "Burn First Card" });

    fireEvent.click(screen.getByRole("button", { name: "Burn First Card" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Trigger Burn Refresh" }),
    );

    await waitFor(() => {
      expect(mockListAllCards).toHaveBeenCalledTimes(5);
    });
  });

  it("shows the login gate on the mint screen when not authenticated", async () => {
    const session = makeSession({ status: "browsing" as const });
    mockUseSession.mockReturnValue(session);
    mockListAllCards.mockResolvedValue(cards);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Mint Tab" }));

    expect(
      screen.getByText("Login as contract owner to access this feature"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(screen.getByTestId("login-modal").textContent).toContain(
      "open:true",
    );
    expect(screen.getByText("Mint Form")).toBeTruthy();
  });

  it("shows the owner gate on the mint screen for authenticated non-owners", async () => {
    const session = makeSession({
      status: "authenticated" as const,
      identityId: "identity-1",
      contractOwnerId: "owner-2",
    });
    mockUseSession.mockReturnValue(session);
    mockListMyCards.mockResolvedValue([cards[1]]);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Mint Tab" }));

    expect(
      screen.getByText(
        "Only the contract owner can mint new cards. Register your own new contract in Settings to try this feature.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByTestId("login-modal").textContent).toContain(
      "open:true",
    );
    expect(screen.getByText("Mint Form")).toBeTruthy();
  });

  it("does not show a gate on the mint screen for the contract owner", async () => {
    const session = makeSession({
      status: "authenticated" as const,
      identityId: "owner-1",
      contractOwnerId: "owner-1",
    });
    mockUseSession.mockReturnValue(session);
    mockListMyCards.mockResolvedValue([cards[1]]);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Mint Tab" }));

    expect(screen.getByText("Mint Form")).toBeTruthy();
    expect(
      screen.queryByText("Login as contract owner to access this feature"),
    ).toBeNull();
    expect(
      screen.queryByText(/Only the contract owner can mint new cards/),
    ).toBeNull();
  });
});
