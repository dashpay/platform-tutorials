// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsView } from "../src/components/SettingsView";
import type { Session } from "../src/session/types";

afterEach(() => {
  cleanup();
});

type Props = Parameters<typeof SettingsView>[0];

const longId = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";
const session = { identityId: longId } as unknown as Session;

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    session: null,
    dpnsNames: {},
    busy: false,
    mnemonic: "",
    identityIndex: "0",
    showAdvanced: false,
    contractId: "",
    contractInput: "",
    onMnemonicChange: vi.fn(),
    onIdentityIndexChange: vi.fn(),
    onShowAdvancedChange: vi.fn(),
    onContractInputChange: vi.fn(),
    onSignIn: vi.fn((event) => event.preventDefault()),
    onSignOut: vi.fn(),
    onContractSubmit: vi.fn((event) => event.preventDefault()),
    onClearContract: vi.fn(),
    onRegisterContract: vi.fn(),
    ...overrides,
  };
}

function renderView(overrides: Partial<Props> = {}) {
  const props = makeProps(overrides);
  return { props, ...render(<SettingsView {...props} />) };
}

describe("SettingsView (signed out)", () => {
  it("disables Sign in until a mnemonic is present and forwards input", () => {
    const onMnemonicChange = vi.fn();
    const { rerender, getByRole } = renderView({ onMnemonicChange });
    expect(
      (getByRole("button", { name: /^sign in$/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    const input = screen.getByLabelText(/identity mnemonic/i);
    fireEvent.change(input, { target: { value: "alpha bravo" } });
    expect(onMnemonicChange).toHaveBeenCalledWith("alpha bravo");

    rerender(<SettingsView {...makeProps({ mnemonic: "alpha bravo" })} />);
    expect(
      (getByRole("button", { name: /^sign in$/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("shows the Dash bridge link with safe rel attributes", () => {
    renderView();
    const link = screen.getByRole("link", { name: /dash bridge/i });
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("submits sign-in when the form is submitted", () => {
    const onSignIn = vi.fn((event) => event.preventDefault());
    renderView({ mnemonic: "alpha bravo", onSignIn });
    // A single-line input submits the form natively (Enter / Sign in button);
    // assert the form's submit handler is wired up.
    fireEvent.submit(screen.getByLabelText(/identity mnemonic/i));
    expect(onSignIn).toHaveBeenCalledOnce();
  });
});

describe("SettingsView (signed in)", () => {
  it("renders the short identity id and a working sign-out button", () => {
    const onSignOut = vi.fn();
    renderView({ session, onSignOut });
    // shortId truncates the 35-char id.
    expect(screen.getByText("ABCDEFG...456789")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("prefers the DPNS name when one is known", () => {
    renderView({ session, dpnsNames: { [longId]: "alice" } });
    expect(screen.getByText("alice")).toBeTruthy();
  });
});

describe("SettingsView advanced section", () => {
  it("toggles the advanced section open", () => {
    const onShowAdvancedChange = vi.fn();
    renderView({ onShowAdvancedChange });
    const toggle = screen.getByRole("button", { name: /advanced settings/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(onShowAdvancedChange).toHaveBeenCalledWith(true);
  });

  it("reveals the identity-index input and contract form when expanded and signed out", () => {
    const onClearContract = vi.fn();
    renderView({
      showAdvanced: true,
      contractId: "c1",
      contractInput: "c1",
      onClearContract,
    });
    expect(screen.getByRole("spinbutton")).toBeTruthy(); // identity index input
    expect(screen.getByText("Current:")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(onClearContract).toHaveBeenCalledOnce();
    // Register new is disabled without a session.
    expect(
      (
        screen.getByRole("button", {
          name: /register new/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("hides the identity-index input when signed in", () => {
    renderView({
      session,
      showAdvanced: true,
      contractId: "c1",
      contractInput: "c1",
    });
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: /register new/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});
