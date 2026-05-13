// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IdentityCard } from "../src/components/IdentityCard";
import type { SessionStatus } from "../src/session/SessionContext";

const { mockUseSession } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

const IDENTITY_ID = "GgZekwh38XcWQTyWWWvmw6CEYFnLU7yiZFPWZEjqKHit";
// IdentityCard calls truncateId(id, 6); head=6 + ellipsis + tail=8.
const TRUNCATED_ID = "GgZekw…ZEjqKHit";
const CONTRACT_ID = "8d6heK6CoskLBi6Rs7cChRG9RuckcZqZst28BdviBe8y";
const TRUNCATED_CONTRACT_LINE = "contract 8d6heK…BdviBe8y";

function renderCard(props: {
  status: SessionStatus;
  identityId: string | null;
  dpnsName: string | null;
  contractId?: string | null;
  onLoginClick?: () => void;
  onOpenSettings?: () => void;
}) {
  return render(
    <IdentityCard
      status={props.status}
      identityId={props.identityId}
      dpnsName={props.dpnsName}
      contractId={props.contractId ?? null}
      onLoginClick={props.onLoginClick ?? vi.fn()}
      onOpenSettings={props.onOpenSettings ?? vi.fn()}
    />,
  );
}

beforeEach(() => {
  mockUseSession.mockReset();
  mockUseSession.mockReturnValue({ logout: vi.fn() });
});

afterEach(() => {
  cleanup();
});

describe("IdentityCard", () => {
  it("shows @-prefixed DPNS name as the primary line when authenticated", () => {
    renderCard({
      status: "authenticated",
      identityId: IDENTITY_ID,
      dpnsName: "alice",
    });
    expect(screen.getByText("@alice")).toBeTruthy();
    // Identity ID becomes the secondary line.
    expect(screen.getByText(TRUNCATED_ID)).toBeTruthy();
  });

  it("falls back to the truncated identity ID as primary when there is no DPNS name", () => {
    renderCard({
      status: "authenticated",
      identityId: IDENTITY_ID,
      dpnsName: null,
    });
    expect(screen.getByText(TRUNCATED_ID)).toBeTruthy();
    expect(screen.queryByText(/^@/)).toBeNull();
  });

  it("shows the contract line as 'contract <truncated>' when no DPNS name is present", () => {
    renderCard({
      status: "authenticated",
      identityId: IDENTITY_ID,
      dpnsName: null,
      contractId: CONTRACT_ID,
    });
    expect(screen.getByText(TRUNCATED_CONTRACT_LINE)).toBeTruthy();
  });

  it("renders the same primary/secondary layout in browsing (read-only) mode", () => {
    renderCard({
      status: "browsing",
      identityId: IDENTITY_ID,
      dpnsName: "alice",
    });
    expect(screen.getByText("@alice")).toBeTruthy();
    expect(screen.getByText(TRUNCATED_ID)).toBeTruthy();
  });

  it("hides the identity layout and shows a Login button when not connected", () => {
    renderCard({
      status: "idle",
      identityId: IDENTITY_ID,
      dpnsName: "alice",
    });
    expect(screen.getByRole("button", { name: /login/i })).toBeTruthy();
    // The identity layout (name + truncated id) must not render in the
    // disconnected state, even when an id and name are passed in.
    expect(screen.queryByText("@alice")).toBeNull();
    expect(screen.queryByText(TRUNCATED_ID)).toBeNull();
  });

  // Regression: when the card was unified into a single menu trigger, readonly
  // (connected-but-not-signed-in) silently lost its one-click path to the
  // login modal — the menu offered Settings and Switch identity but no direct
  // Login. The card must call onLoginClick on click and render no menu.
  it("calls onLoginClick on click when readonly, without opening a menu", () => {
    const onLoginClick = vi.fn();
    renderCard({
      status: "readonly",
      identityId: null,
      dpnsName: null,
      onLoginClick,
    });
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);
    expect(onLoginClick).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens a menu when the connected card is clicked", () => {
    renderCard({
      status: "authenticated",
      identityId: IDENTITY_ID,
      dpnsName: null,
    });
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("calls onOpenSettings when Settings is chosen from the menu", () => {
    const onOpenSettings = vi.fn();
    renderCard({
      status: "authenticated",
      identityId: IDENTITY_ID,
      dpnsName: null,
      onOpenSettings,
    });
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(screen.getByRole("menuitem", { name: /settings/i }));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it("calls onLoginClick when Switch identity is chosen from the menu", () => {
    const onLoginClick = vi.fn();
    renderCard({
      status: "authenticated",
      identityId: IDENTITY_ID,
      dpnsName: null,
      onLoginClick,
    });
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(screen.getByRole("menuitem", { name: /switch identity/i }));
    expect(onLoginClick).toHaveBeenCalled();
  });

  it("calls session.logout when Log out is chosen from the menu", () => {
    const logout = vi.fn();
    mockUseSession.mockReturnValue({ logout });
    renderCard({
      status: "authenticated",
      identityId: IDENTITY_ID,
      dpnsName: null,
    });
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(screen.getByRole("menuitem", { name: /log out/i }));
    expect(logout).toHaveBeenCalled();
  });

  it("hides Log out when browsing read-only", () => {
    renderCard({
      status: "browsing",
      identityId: IDENTITY_ID,
      dpnsName: null,
    });
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.queryByRole("menuitem", { name: /log out/i })).toBeNull();
  });
});
