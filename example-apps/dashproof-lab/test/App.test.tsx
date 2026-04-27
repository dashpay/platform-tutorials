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

const { mockUseSession } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
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
    onTabChange: (tab: "anchor" | "verify" | "history") => void;
  }) => (
    <div>
      <button type="button" onClick={onLoginOpen}>
        Open Settings
      </button>
      <button type="button" onClick={() => onTabChange("verify")}>
        Verify Tab
      </button>
      <button type="button" onClick={() => onTabChange("history")}>
        History Tab
      </button>
      {children}
    </div>
  ),
}));

vi.mock("../src/components/AnchorForm", () => ({
  AnchorForm: () => <div>Anchor Form</div>,
}));

vi.mock("../src/components/VerifyPanel", () => ({
  VerifyPanel: ({
    onViewChainHistory,
  }: {
    onViewChainHistory?: (chainId: string) => void;
  }) => (
    <div>
      Verify Panel
      <button type="button" onClick={() => onViewChainHistory?.("chain-from-verify")}>
        Open Chain History
      </button>
    </div>
  ),
}));

vi.mock("../src/components/HistoryPanel", () => ({
  HistoryPanel: ({
    requestedChainId,
  }: {
    requestedChainId?: string | null;
  }) => <div>History Panel:{requestedChainId ?? ""}</div>,
}));

vi.mock("../src/components/LoginModal", () => ({
  LoginModal: ({ open }: { open: boolean }) => (
    <div data-testid="login-modal">open:{String(open)}</div>
  ),
}));

vi.mock("../src/components/ExampleFilesModal", () => ({
  ExampleFilesModal: ({ open }: { open: boolean }) => (
    <div data-testid="starter-files-modal">open:{String(open)}</div>
  ),
}));

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    status: "idle",
    error: null,
    identityId: null,
    contractId: "contract-1",
    enterReadOnly: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  mockUseSession.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("App", () => {
  it("auto-connects in read-only mode from idle", async () => {
    const session = makeSession();
    mockUseSession.mockReturnValue(session);

    render(<App />);

    await waitFor(() => {
      expect(session.enterReadOnly).toHaveBeenCalled();
    });
  });

  it("wires screen switching and modal state through mocked child components", () => {
    mockUseSession.mockReturnValue(makeSession({ status: "readonly" }));

    render(<App />);
    expect(screen.getByText("Anchor Form")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Verify Tab" }));
    expect(screen.getByText("Verify Panel")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Chain History" }));
    expect(screen.getByText("History Panel:chain-from-verify")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /starter files/i }));
    expect(screen.getByTestId("starter-files-modal").textContent).toBe(
      "open:true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    expect(screen.getByTestId("login-modal").textContent).toBe("open:true");
  });
});
