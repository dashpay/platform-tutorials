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
import type { DashKeyManager, DashSdk } from "../src/dash/types";
import type { ResolvedRecipient } from "../src/hooks/useResolvedRecipient";

const {
  mockUseSession,
  mockListAllCards,
  mockListMyCards,
  mockListMarketplaceCards,
  mockTransferDashMintTokens,
  mockUseDpnsName,
  mockUseResolvedRecipient,
} = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockListAllCards: vi.fn(),
  mockListMyCards: vi.fn(),
  mockListMarketplaceCards: vi.fn(),
  mockTransferDashMintTokens: vi.fn(),
  mockUseDpnsName: vi.fn(),
  mockUseResolvedRecipient: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/dash/queries", () => ({
  listAllCards: mockListAllCards,
  listMyCards: mockListMyCards,
  listMarketplaceCards: mockListMarketplaceCards,
}));

vi.mock("../src/dash/transferDashMintTokens", () => ({
  transferDashMintTokens: mockTransferDashMintTokens,
}));

vi.mock("../src/hooks/useDpnsName", () => ({
  useDpnsName: mockUseDpnsName,
}));

vi.mock("../src/hooks/useResolvedRecipient", () => ({
  useResolvedRecipient: mockUseResolvedRecipient,
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
    onTabChange: (
      tab: "collection" | "mint" | "tokens" | "how-it-works",
    ) => void;
  }) => (
    <div>
      <button type="button" onClick={onLoginOpen}>
        Open Login
      </button>
      <button type="button" onClick={() => onTabChange("collection")}>
        Collection Tab
      </button>
      <button type="button" onClick={() => onTabChange("tokens")}>
        Tokens Tab
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
  CollectionToolbar: () => <button type="button">Sort</button>,
  RefreshSpinner: () => <span>Refreshing</span>,
}));

vi.mock("../src/components/CardGrid", () => ({
  CardGrid: ({ cards }: { cards: Card[] }) => (
    <div data-testid="cards">
      {cards.map((card) => card.data.name).join("|")}
    </div>
  ),
}));

vi.mock("../src/components/LoginModal", () => ({
  LoginModal: ({ open }: { open: boolean }) => (
    <div data-testid="login-modal">open:{String(open)}</div>
  ),
}));

vi.mock("../src/components/TransferModal", () => ({
  TransferModal: () => <div data-testid="transfer-modal" />,
}));

vi.mock("../src/components/SetPriceModal", () => ({
  SetPriceModal: () => <div data-testid="set-price-modal" />,
}));

vi.mock("../src/components/PurchaseModal", () => ({
  PurchaseModal: () => <div data-testid="purchase-modal" />,
}));

vi.mock("../src/components/BurnModal", () => ({
  BurnModal: () => <div data-testid="burn-modal" />,
}));

vi.mock("../src/components/MintForm", () => ({
  MintForm: () => <div>Mint Form</div>,
}));

vi.mock("../src/components/HowItWorks", () => ({
  HowItWorks: () => <div>How It Works</div>,
}));

const sessionValue = {
  status: "authenticated" as const,
  sdk: {} as DashSdk,
  keyManager: {} as DashKeyManager,
  identityId: "sender-1",
  contractId: "contract-1",
  contractOwnerId: null as string | null,
  balance: null as bigint | null,
  dashMintTokenBalance: 10n,
  refreshBalance: vi.fn(),
  log: vi.fn(),
  browseOnly: vi.fn().mockResolvedValue(undefined),
};

const cards: Card[] = [
  {
    id: "card-1",
    ownerId: "sender-1",
    data: { name: "Fire Dragon", attack: 9, defense: 8 },
  },
];

const SAMPLE_ID = "5LmvdJbGAtnk2Z3y5bwa2YcX9hk5GhVePtkT21a2mxAn";
function resolved(identityId: string): ResolvedRecipient {
  return { status: "resolved", identityId };
}

beforeEach(() => {
  mockUseSession.mockReset();
  mockListAllCards.mockReset();
  mockListMyCards.mockReset();
  mockListMarketplaceCards.mockReset();
  mockTransferDashMintTokens.mockReset();
  mockUseDpnsName.mockReset();
  mockUseResolvedRecipient.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("App token transfer navigation", () => {
  it("does not retain a token transfer success after leaving and returning to Tokens", async () => {
    mockUseSession.mockReturnValue(sessionValue);
    mockListMyCards.mockResolvedValue(cards);
    mockUseDpnsName.mockReturnValue(null);
    mockUseResolvedRecipient.mockReturnValue(resolved(SAMPLE_ID));
    mockTransferDashMintTokens.mockResolvedValue(undefined);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Tokens Tab" }));
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Recipient identity or DPNS name"), {
      target: { value: "alice.dash" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));

    await screen.findByRole("status");
    expect(screen.getByRole("status").textContent).toContain(
      "DashMint tokens transferred successfully.",
    );
    expect(mockTransferDashMintTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: "contract-1",
        recipientId: SAMPLE_ID,
        amount: 2n,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Collection Tab" }));
    await waitFor(() => {
      expect(screen.queryByRole("status")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Tokens Tab" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
