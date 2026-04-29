// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IdentityCard } from "../src/components/IdentityCard";

afterEach(() => {
  cleanup();
});

describe("IdentityCard", () => {
  it("renders a Login button when not connected and triggers onLoginClick", () => {
    const onLoginClick = vi.fn();
    render(
      <IdentityCard
        status="idle"
        identityId={null}
        contractId={null}
        onLoginClick={onLoginClick}
      />,
    );

    const button = screen.getByRole("button", { name: /login/i });
    fireEvent.click(button);
    expect(onLoginClick).toHaveBeenCalled();
    expect(screen.getByText(/offline/i)).toBeTruthy();
  });

  it("shows the connecting label while the session is connecting", () => {
    render(
      <IdentityCard
        status="connecting"
        identityId={null}
        contractId={null}
        onLoginClick={vi.fn()}
      />,
    );

    expect(screen.getByText(/connecting/i)).toBeTruthy();
  });

  it("renders the Connected state in read-only mode without identity details", () => {
    render(
      <IdentityCard
        status="readonly"
        identityId={null}
        contractId="contract-123"
        onLoginClick={vi.fn()}
      />,
    );

    expect(screen.getByText(/connected/i)).toBeTruthy();
    expect(screen.queryByText(/signed in/i)).toBeNull();
  });

  it("shows truncated identity + contract when authenticated", () => {
    render(
      <IdentityCard
        status="authenticated"
        identityId="ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        contractId="contractABCDEFGHIJKLMNOPQR"
        onLoginClick={vi.fn()}
      />,
    );

    expect(screen.getByText(/signed in/i)).toBeTruthy();
    expect(screen.getByText(/authenticated/i)).toBeTruthy();
    expect(screen.getByText("ABCDEF…STUVWXYZ")).toBeTruthy();
    expect(screen.getByText(/contract contra…KLMNOPQR/i)).toBeTruthy();
  });

  it("opens settings when authenticated card is clicked", () => {
    const onLoginClick = vi.fn();
    render(
      <IdentityCard
        status="authenticated"
        identityId="abc"
        contractId="def"
        onLoginClick={onLoginClick}
      />,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onLoginClick).toHaveBeenCalled();
  });
});
