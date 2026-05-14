// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
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

vi.mock("../src/components/NotesWorkspace", () => ({
  NotesWorkspace: () => <div>Notes Workspace</div>,
}));

vi.mock("../src/components/HowItWorks", () => ({
  HowItWorks: () => <div>How It Works</div>,
}));

vi.mock("../src/components/AppShell", () => ({
  AppShell: ({
    children,
    onLoginOpen,
    onTabChange,
  }: {
    children: ReactNode;
    onLoginOpen: () => void;
    onTabChange: (tab: "notes" | "how-it-works" | "settings") => void;
  }) => (
    <div>
      <button type="button" onClick={onLoginOpen}>
        Open settings
      </button>
      <button type="button" onClick={() => onTabChange("how-it-works")}>
        How it works tab
      </button>
      <button type="button" onClick={() => onTabChange("settings")}>
        Settings tab
      </button>
      {children}
    </div>
  ),
}));

vi.mock("../src/components/LoginModal", () => ({
  LoginModal: ({ open }: { open: boolean }) => <div>login:{String(open)}</div>,
}));

vi.mock("../src/components/ActivityPanel", () => ({
  ActivityPanel: ({ open }: { open: boolean }) => (
    <div>activity:{String(open)}</div>
  ),
}));

vi.mock("../src/components/NotesToolbar", () => ({
  NotesToolbar: ({
    title,
    onOpenActivity,
  }: {
    title: string;
    onOpenActivity?: () => void;
  }) => (
    <div>
      toolbar:{title}
      {onOpenActivity && (
        <button type="button" onClick={onOpenActivity}>
          Open activity
        </button>
      )}
    </div>
  ),
}));

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    status: "idle",
    error: null,
    sdk: null,
    identityId: null,
    contractId: null,
    rememberedIdentityId: null,
    dpnsName: null,
    enterReadOnly: vi.fn().mockResolvedValue(undefined),
    viewAsRemembered: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  mockUseSession.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("App", () => {
  it("auto-connects in read-only mode from idle when no identity is remembered", async () => {
    const session = makeSession();
    mockUseSession.mockReturnValue(session);

    render(<App />);

    await waitFor(() => {
      expect(session.enterReadOnly).toHaveBeenCalled();
    });
    expect(session.viewAsRemembered).not.toHaveBeenCalled();
  });

  it("finishes wiring up the SDK when boot starts in browsing mode without an SDK", async () => {
    const session = makeSession({
      status: "browsing",
      sdk: null,
      rememberedIdentityId: "remembered-identity-id",
    });
    mockUseSession.mockReturnValue(session);

    render(<App />);

    await waitFor(() => {
      expect(session.viewAsRemembered).toHaveBeenCalled();
    });
    expect(session.enterReadOnly).not.toHaveBeenCalled();
  });

  it("does not re-trigger viewAsRemembered once the SDK is initialized", async () => {
    const session = makeSession({
      status: "browsing",
      sdk: {},
      rememberedIdentityId: "remembered-identity-id",
    });
    mockUseSession.mockReturnValue(session);

    render(<App />);

    await Promise.resolve();
    expect(session.viewAsRemembered).not.toHaveBeenCalled();
    expect(session.enterReadOnly).not.toHaveBeenCalled();
  });

  it("switches tabs and opens the settings modal", () => {
    mockUseSession.mockReturnValue(makeSession({ status: "readonly" }));

    render(<App />);
    expect(screen.getAllByText("Notes Workspace")[0]).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /how it works tab/i }));
    expect(screen.getByText("How It Works")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /open settings/i }));
    expect(screen.getByText("login:true")).toBeTruthy();
  });

  it("opens the activity panel via ⌘L hotkey and toolbar button", () => {
    mockUseSession.mockReturnValue(makeSession({ status: "readonly" }));

    render(<App />);
    expect(screen.getByText("activity:false")).toBeTruthy();

    fireEvent.keyDown(window, { key: "l", metaKey: true });
    expect(screen.getByText("activity:true")).toBeTruthy();

    // Toggling again closes it.
    fireEvent.keyDown(window, { key: "l", metaKey: true });
    expect(screen.getByText("activity:false")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /open activity/i }));
    expect(screen.getByText("activity:true")).toBeTruthy();
  });

  it("renders SettingsPanel when the settings tab is selected", () => {
    mockUseSession.mockReturnValue(
      makeSession({
        status: "authenticated",
        identityId: "id-app-settings",
        contractId: "contract-app-settings",
        sdk: { documents: {} },
      }),
    );

    render(<App />);
    expect(screen.queryByTestId("settings-identity-block")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /settings tab/i }));
    expect(screen.getByTestId("settings-identity-block")).toBeTruthy();
    expect(screen.getByText("id-app-settings")).toBeTruthy();
  });
});
