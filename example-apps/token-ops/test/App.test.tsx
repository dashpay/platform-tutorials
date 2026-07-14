// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { View } from "../src/components/TopNav";

const mockUseSession = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  Toaster: () => null,
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/components/LoginModal", () => ({
  LoginModal: () => null,
}));

vi.mock("../src/components/OverviewView", () => ({
  OverviewView: ({
    onNavigateToPending,
    onNavigateToGovernance,
  }: {
    onNavigateToPending: () => void;
    onNavigateToGovernance: () => void;
  }) => (
    <section>
      <h2>Dashboard page</h2>
      <button type="button" onClick={onNavigateToPending}>
        Pending shortcut
      </button>
      <button type="button" onClick={onNavigateToGovernance}>
        Governance shortcut
      </button>
    </section>
  ),
}));

vi.mock("../src/components/ActionsView", () => ({
  ActionsView: () => (
    <>
      <h2>Operations page</h2>
      <h2>Pending page</h2>
    </>
  ),
}));

vi.mock("../src/components/GovernanceView", () => ({
  GovernanceView: () => <h2>Governance page</h2>,
}));

vi.mock("../src/components/SettingsView", () => ({
  SettingsView: () => <h2>Settings page</h2>,
}));

import App from "../src/App";

function mockSession() {
  mockUseSession.mockReturnValue({
    status: "readonly",
    error: null,
    sdk: {},
    keyManager: null,
    identityId: null,
    contractId: "contract-1",
    setContractId: vi.fn(),
    log: vi.fn(),
    login: vi.fn(),
    enterReadOnly: vi.fn(),
    logout: vi.fn(),
  });
}

function setHash(view: View | "") {
  window.history.replaceState({}, "", view ? `/#${view}` : "/");
}

describe("App hash routing", () => {
  beforeEach(() => {
    mockSession();
    setHash("");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    setHash("");
  });

  it("opens directly to a hash-linked page", () => {
    setHash("governance");

    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Governance page" }),
    ).toBeTruthy();
  });

  it("updates the hash when changing tabs", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));

    expect(window.location.hash).toBe("#actions");
    expect(
      screen.getByRole("heading", { name: "Operations page" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Pending page" })).toBeTruthy();
  });

  it("updates the selected page when the hash changes", () => {
    render(<App />);

    setHash("settings");
    fireEvent(window, new Event("hashchange"));

    expect(screen.getByRole("heading", { name: "Settings page" })).toBeTruthy();
  });

  it("uses hash routing for the overview pending shortcut", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Pending shortcut" }));

    expect(window.location.hash).toBe("#actions");
    expect(screen.getByRole("heading", { name: "Pending page" })).toBeTruthy();
  });

  it("uses hash routing for the dashboard governance shortcut", () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: "Governance shortcut" }),
    );

    expect(window.location.hash).toBe("#governance");
    expect(
      screen.getByRole("heading", { name: "Governance page" }),
    ).toBeTruthy();
  });
});
