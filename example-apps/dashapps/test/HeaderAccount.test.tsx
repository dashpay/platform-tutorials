// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HeaderAccount } from "../src/components/HeaderAccount";
import { useSession } from "../src/session/useSession";
import { id } from "./helpers";

vi.mock("../src/session/useSession", () => ({ useSession: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("opens sign-in from the header in a body-level dialog", () => {
  vi.mocked(useSession).mockReturnValue({
    network: "testnet",
    connection: {},
    identityId: null,
  } as never);
  render(<HeaderAccount />);

  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

  const form = screen.getByRole("heading", { name: "Sign in to dashapps" });
  expect(form.closest(".header-signin-backdrop")?.parentElement).toBe(
    document.body,
  );
});

it("shows the signed-in name and signs out from the header", () => {
  const logout = vi.fn();
  const identityId = id(1);
  vi.mocked(useSession).mockReturnValue({
    identityId,
    identityName: "alice",
    logout,
  } as never);
  render(<HeaderAccount />);

  expect(screen.getByText("alice.dash").getAttribute("title")).toBe(identityId);
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(logout).toHaveBeenCalledOnce();
});
