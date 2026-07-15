// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TopNav } from "../src/components/TopNav";

describe("TopNav", () => {
  afterEach(() => cleanup());

  it("opens login from the read-only state", () => {
    const onLoginClick = vi.fn();

    render(
      <TopNav
        view="overview"
        onViewChange={vi.fn()}
        status="readonly"
        identityId={null}
        onLoginClick={onLoginClick}
        onLogout={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onLoginClick).toHaveBeenCalledOnce();
  });

  it("shows only sign out when authenticated", () => {
    const onLogout = vi.fn();

    render(
      <TopNav
        view="overview"
        onViewChange={vi.fn()}
        status="authenticated"
        identityId="identity-1"
        onLoginClick={vi.fn()}
        onLogout={onLogout}
      />,
    );

    expect(screen.queryByText("Signed in")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(onLogout).toHaveBeenCalledOnce();
  });
});
