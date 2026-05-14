// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginModal } from "../src/components/LoginModal";

const { mockUseSession, mockUseWifPreview } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockUseWifPreview: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

// Mocked so LoginModal's preview-rendering branches can be exercised
// independently of the hook's debounce/network/cache logic (which has its
// own test file). Each test sets the return value to the state it cares
// about. Default: idle.
vi.mock("../src/hooks/useWifPreview", () => ({
  useWifPreview: mockUseWifPreview,
}));

interface SessionOverrides {
  status?: string;
  dpnsName?: string | null;
  contractId?: string | null;
  identityId?: string | null;
  sdk?: unknown;
  keyManager?: unknown;
  login?: ReturnType<typeof vi.fn>;
  logout?: ReturnType<typeof vi.fn>;
  setContractId?: ReturnType<typeof vi.fn>;
  log?: ReturnType<typeof vi.fn>;
  rememberedIdentityId?: string | null;
  forgetIdentity?: ReturnType<typeof vi.fn>;
}

function makeSession(overrides: SessionOverrides = {}) {
  return {
    status: "readonly",
    error: null,
    sdk: { documents: {} },
    keyManager: null,
    identityId: null,
    contractId: null,
    rememberedIdentityId: null,
    dpnsName: null,
    log: vi.fn(),
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    setContractId: vi.fn(),
    enterReadOnly: vi.fn().mockResolvedValue(undefined),
    viewAsRemembered: vi.fn().mockResolvedValue(undefined),
    forgetIdentity: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockUseSession.mockReset();
  mockUseWifPreview.mockReset();
  mockUseWifPreview.mockReturnValue({ status: "idle" });
});

afterEach(() => {
  cleanup();
});

describe("LoginModal", () => {
  it("renders nothing when closed", () => {
    mockUseSession.mockReturnValue(makeSession());
    const { container } = render(<LoginModal open={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  // Regression: an earlier auto-close effect dismissed the modal whenever it
  // was opened while session.status === "authenticated", which broke the
  // Switch-identity flow (the modal would flash and vanish).
  it("stays open when opened in an authenticated session (Switch identity)", () => {
    const onClose = vi.fn();
    mockUseSession.mockReturnValue(
      makeSession({
        status: "authenticated",
        identityId: "id-already-signed-in",
        keyManager: { getAuth: vi.fn() },
      }),
    );

    render(<LoginModal open onClose={onClose} />);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/mnemonic phrase/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeTruthy();
  });

  it("submits the mnemonic via session.login and closes on success", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    mockUseSession.mockReturnValue(makeSession({ login }));

    render(<LoginModal open onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText(/mnemonic phrase/i), {
      target: { value: "test mnemonic phrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("test mnemonic phrase", {
        identityIndex: 0,
        rememberMe: true,
      });
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("displays an error when login throws", async () => {
    const login = vi.fn().mockRejectedValue(new Error("Bad mnemonic"));
    mockUseSession.mockReturnValue(makeSession({ login }));

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/mnemonic phrase/i), {
      target: { value: "garbage" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText("Bad mnemonic")).toBeTruthy();
  });

  it("disables the login button while the mnemonic field is empty", () => {
    mockUseSession.mockReturnValue(makeSession());

    render(<LoginModal open onClose={vi.fn()} />);

    const button = screen.getByRole("button", {
      name: /^sign in$/i,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("keeps the login button disabled for a whitespace-only secret", () => {
    mockUseSession.mockReturnValue(makeSession());

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/mnemonic phrase/i), {
      target: { value: "   \t  " },
    });

    const button = screen.getByRole("button", {
      name: /^sign in$/i,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("disables the login button while a login is in flight", async () => {
    // Resolve manually so we can observe the in-flight state. The label
    // also flips to "Connecting…" while submitting is true.
    let resolveLogin: (() => void) | undefined;
    const login = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = () => resolve();
        }),
    );
    mockUseSession.mockReturnValue(makeSession({ login }));

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/mnemonic phrase/i), {
      target: { value: "phrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    const connectingButton = (await screen.findByRole("button", {
      name: /connecting/i,
    })) as HTMLButtonElement;
    expect(connectingButton.disabled).toBe(true);

    resolveLogin?.();
    await waitFor(() => {
      expect(login).toHaveBeenCalled();
    });
  });

  it("falls back to identityIndex=0 when the index field is non-numeric", async () => {
    // Number.parseInt("abc", 10) is NaN; the handler must coerce that to 0
    // rather than passing NaN through to session.login.
    const login = vi.fn().mockResolvedValue(undefined);
    mockUseSession.mockReturnValue(makeSession({ login }));

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByText(/advanced settings/i));
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "abc" },
    });
    fireEvent.change(screen.getByPlaceholderText(/mnemonic phrase/i), {
      target: { value: "phrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("phrase", {
        identityIndex: 0,
        rememberMe: true,
      });
    });
  });

  it("preserves identityIndex and showAdvanced across modal reopens", () => {
    // The open-effect resets secret/rememberMe/useDifferentIdentity/error,
    // but NOT identityIndex or showAdvanced — verify that contract so a
    // future refactor doesn't quietly change it.
    mockUseSession.mockReturnValue(makeSession());

    const { rerender } = render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByText(/advanced settings/i));
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "7" },
    });

    rerender(<LoginModal open={false} onClose={vi.fn()} />);
    rerender(<LoginModal open onClose={vi.fn()} />);

    // Disclosure is still open, value still 7.
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe(
      "7",
    );
  });

  it("uses identity index from advanced settings", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    mockUseSession.mockReturnValue(makeSession({ login }));

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByText(/advanced settings/i));
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByPlaceholderText(/mnemonic phrase/i), {
      target: { value: "phrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("phrase", {
        identityIndex: 3,
        rememberMe: true,
      });
    });
  });

  it("defaults the Remember-me checkbox on when no identity is remembered", () => {
    mockUseSession.mockReturnValue(makeSession());

    render(<LoginModal open onClose={vi.fn()} />);

    const checkbox = screen.getByRole("checkbox", {
      name: /remember this identity on this device/i,
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("defaults the Remember-me checkbox on when an identity is already remembered", () => {
    mockUseSession.mockReturnValue(
      makeSession({ rememberedIdentityId: "remembered-identity-id" }),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    const checkbox = screen.getByRole("checkbox", {
      name: /remember this identity on this device/i,
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("renders the Remember-me checkbox above Advanced settings", () => {
    mockUseSession.mockReturnValue(makeSession());

    render(<LoginModal open onClose={vi.fn()} />);

    const checkbox = screen.getByRole("checkbox", {
      name: /remember this identity on this device/i,
    });
    const advanced = screen.getByRole("button", { name: /advanced settings/i });
    expect(
      checkbox.compareDocumentPosition(advanced) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("forwards rememberMe=true by default to session.login", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    mockUseSession.mockReturnValue(makeSession({ login }));

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/mnemonic phrase/i), {
      target: { value: "phrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("phrase", {
        identityIndex: 0,
        rememberMe: true,
      });
    });
  });

  it("forwards rememberMe=false when the user opts out", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    mockUseSession.mockReturnValue(makeSession({ login }));

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /remember this identity on this device/i,
      }),
    );
    fireEvent.change(screen.getByPlaceholderText(/mnemonic phrase/i), {
      target: { value: "phrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("phrase", {
        identityIndex: 0,
        rememberMe: false,
      });
    });
  });

  it("shows the remembered identity as a read-only field above the mnemonic", () => {
    mockUseSession.mockReturnValue(
      makeSession({
        status: "browsing",
        identityId: "remembered-identity-id",
        rememberedIdentityId: "remembered-identity-id",
      }),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    const identityField = screen.getByLabelText(
      /remembered identity/i,
    ) as HTMLInputElement;
    expect(identityField.readOnly).toBe(true);
    expect(identityField.value).toBe("remembered-identity-id");

    const mnemonicField = screen.getByPlaceholderText(
      /mnemonic phrase or wif private key/i,
    );
    expect(
      identityField.compareDocumentPosition(mnemonicField) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("hides the Dash bridge prompt when an identity is remembered", () => {
    mockUseSession.mockReturnValue(
      makeSession({ rememberedIdentityId: "remembered-identity-id" }),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    expect(screen.queryByText(/dash bridge/i)).toBeNull();
  });

  it("shows the Dash bridge prompt when no identity is remembered", () => {
    mockUseSession.mockReturnValue(makeSession());

    render(<LoginModal open onClose={vi.fn()} />);

    expect(screen.getByText(/dash bridge/i)).toBeTruthy();
  });

  it("renders the switch/forget actions below the mnemonic field", () => {
    mockUseSession.mockReturnValue(
      makeSession({ rememberedIdentityId: "remembered-identity-id" }),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    const mnemonicField = screen.getByPlaceholderText(
      /mnemonic phrase or wif private key/i,
    );
    const actions = screen.getByTestId("remembered-identity-actions");
    expect(
      mnemonicField.compareDocumentPosition(actions) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("hides the panel and shows a notice when Use a different identity is clicked", () => {
    const forgetIdentity = vi.fn();
    mockUseSession.mockReturnValue(
      makeSession({
        rememberedIdentityId: "remembered-identity-id",
        forgetIdentity,
      }),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: /use a different identity/i }),
    );

    expect(screen.queryByTestId("remembered-identity-panel")).toBeNull();
    expect(screen.getByTestId("different-identity-notice")).toBeTruthy();
    expect(forgetIdentity).not.toHaveBeenCalled();

    const checkbox = screen.getByRole("checkbox", {
      name: /remember this identity on this device/i,
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("hides the remembered identity panel when no identity is remembered", () => {
    mockUseSession.mockReturnValue(makeSession());

    render(<LoginModal open onClose={vi.fn()} />);

    expect(screen.queryByTestId("remembered-identity-panel")).toBeNull();
  });

  it("calls onClose when the Cancel button is clicked from the login form", () => {
    const onClose = vi.fn();
    mockUseSession.mockReturnValue(makeSession());

    render(<LoginModal open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("submits with rememberMe=true after switching to a different identity", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    mockUseSession.mockReturnValue(
      makeSession({
        login,
        rememberedIdentityId: "remembered-identity-id",
      }),
    );

    render(<LoginModal open onClose={onClose} />);

    fireEvent.click(
      screen.getByRole("button", { name: /use a different identity/i }),
    );
    fireEvent.change(
      screen.getByPlaceholderText(/mnemonic phrase/i) as HTMLInputElement,
      { target: { value: "fresh mnemonic" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("fresh mnemonic", {
        identityIndex: 0,
        rememberMe: true,
      });
    });
  });

  it("resets useDifferentIdentity and rememberMe when the modal reopens", () => {
    mockUseSession.mockReturnValue(
      makeSession({ rememberedIdentityId: "remembered-identity-id" }),
    );

    const { rerender } = render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: /use a different identity/i }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /remember this identity on this device/i,
      }),
    );

    expect(screen.queryByTestId("remembered-identity-panel")).toBeNull();
    expect(
      (
        screen.getByRole("checkbox", {
          name: /remember this identity on this device/i,
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);

    rerender(<LoginModal open={false} onClose={vi.fn()} />);
    rerender(<LoginModal open onClose={vi.fn()} />);

    expect(screen.getByTestId("remembered-identity-panel")).toBeTruthy();
    expect(
      (
        screen.getByRole("checkbox", {
          name: /remember this identity on this device/i,
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it("remembered panel shows the cached DPNS name as a ✓ name.dash caption", () => {
    mockUseSession.mockReturnValue(
      makeSession({
        rememberedIdentityId: "remembered-identity-id",
        dpnsName: "alice",
      }),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    const panel = screen.getByTestId("remembered-identity-panel");
    expect(within(panel).getByText("✓ alice.dash")).toBeTruthy();
  });

  it("remembered panel omits the DPNS caption when no name is cached", () => {
    mockUseSession.mockReturnValue(
      makeSession({
        rememberedIdentityId: "remembered-identity-id",
        dpnsName: null,
      }),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    const panel = screen.getByTestId("remembered-identity-panel");
    expect(within(panel).queryByText(/\.dash$/)).toBeNull();
  });

  it("shows the identity-index field for mnemonic input under Advanced settings", () => {
    mockUseSession.mockReturnValue(makeSession());
    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/mnemonic phrase/i), {
      target: { value: "abandon abandon abandon" },
    });
    fireEvent.click(screen.getByText(/advanced settings/i));

    expect(screen.queryByRole("spinbutton")).not.toBeNull();
  });

  it("hides the Advanced settings disclosure when the input parses as a WIF", () => {
    // WIF input has no DIP-13 derivation, so the only knob inside Advanced
    // (Identity index) is irrelevant — the disclosure itself disappears.
    mockUseSession.mockReturnValue(makeSession());
    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/mnemonic phrase/i), {
      target: { value: "cVHcfvcWNc7DvqaPCwM6Z3DqZ" },
    });

    expect(screen.queryByText(/advanced settings/i)).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("forwards a WIF input verbatim to session.login", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    mockUseSession.mockReturnValue(makeSession({ login }));

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/mnemonic phrase/i), {
      target: { value: "cVHcfvcWNc7DvqaPCwM6Z3DqZ" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("cVHcfvcWNc7DvqaPCwM6Z3DqZ", {
        identityIndex: 0,
        rememberMe: true,
      });
    });
  });

  describe("WIF eager-preview rendering", () => {
    // The preview region only mounts when the secret is detected as WIF
    // shape (no whitespace). Each test types a WIF-shaped string and lets
    // the mocked useWifPreview return the state under test.
    const SAMPLE_WIF = "cVHcfvcWNc7DvqaPCwM6Z3DqZ";

    function renderWithSecret(state: {
      status: string;
      identityId?: string;
      dpnsName?: string | null;
      purposeName?: string;
      securityLevelName?: string;
    }) {
      mockUseSession.mockReturnValue(makeSession());
      mockUseWifPreview.mockReturnValue(state);
      const view = render(<LoginModal open onClose={vi.fn()} />);
      fireEvent.change(view.getByPlaceholderText(/mnemonic phrase/i), {
        target: { value: SAMPLE_WIF },
      });
      return view;
    }

    it("hides the preview region when state is idle", () => {
      renderWithSecret({ status: "idle" });
      expect(screen.queryByTestId("wif-preview")).toBeNull();
    });

    it("shows 'Checking…' while resolving", () => {
      renderWithSecret({ status: "checking" });
      expect(screen.getByTestId("wif-preview").textContent).toMatch(
        /checking/i,
      );
    });

    it("prefers DPNS name over truncated ID on the resolved state", () => {
      renderWithSecret({
        status: "resolved",
        identityId: "abcdef0123456789xyz",
        dpnsName: "alice",
      });
      const text = screen.getByTestId("wif-preview").textContent ?? "";
      expect(text).toContain("alice.dash");
      expect(text).not.toContain("abcdef01");
    });

    it("falls back to a truncated identity ID when DPNS name is null", () => {
      renderWithSecret({
        status: "resolved",
        identityId: "abcdefghijklmnopqrstuvwx",
        dpnsName: null,
      });
      const text = screen.getByTestId("wif-preview").textContent ?? "";
      // First 8 chars + last 4 chars, with an ellipsis in between.
      expect(text).toContain("abcdefgh");
      expect(text).toContain("uvwx");
    });

    it("labels MASTER auth keys distinctly from purpose mismatches", () => {
      renderWithSecret({
        status: "wrong-purpose",
        identityId: "id-master",
        dpnsName: null,
        purposeName: "AUTHENTICATION",
        securityLevelName: "MASTER",
      });
      const text = screen.getByTestId("wif-preview").textContent ?? "";
      expect(text).toMatch(/MASTER authentication/);
      // Must not call it just "AUTHENTICATION key" — that would be confusing
      // (every auth key is an "authentication" key).
      expect(text).not.toMatch(/this is a AUTHENTICATION key/);
    });

    it("uses purposeName directly for non-AUTHENTICATION purposes", () => {
      renderWithSecret({
        status: "wrong-purpose",
        identityId: "id-transfer",
        dpnsName: null,
        purposeName: "TRANSFER",
        // Using a level name that does NOT appear in the static suffix
        // ("HIGH or CRITICAL authentication key instead") so we can verify
        // the conditional doesn't insert it for non-AUTHENTICATION purposes.
        securityLevelName: "MEDIUM",
      });
      const text = screen.getByTestId("wif-preview").textContent ?? "";
      expect(text).toMatch(/this is a TRANSFER key/);
      // securityLevelName is only relevant for AUTHENTICATION + non-HIGH/CRITICAL;
      // for TRANSFER it must not appear.
      expect(text).not.toContain("MEDIUM");
    });

    it("disables the Login button when preview is wrong-purpose", () => {
      renderWithSecret({
        status: "wrong-purpose",
        identityId: "id-x",
        dpnsName: null,
        purposeName: "TRANSFER",
        securityLevelName: "CRITICAL",
      });
      const button = screen.getByRole("button", {
        name: /^sign in$/i,
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("disables the Login button when preview is key-disabled", () => {
      renderWithSecret({
        status: "key-disabled",
        identityId: "id-y",
        dpnsName: null,
      });
      const button = screen.getByRole("button", {
        name: /^sign in$/i,
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("leaves the Login button enabled while preview is checking", () => {
      // We don't want to block submission on a debounce — the user should
      // be able to hit Enter immediately after pasting.
      renderWithSecret({ status: "checking" });
      const button = screen.getByRole("button", {
        name: /^sign in$/i,
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });

    it("does not render the preview when input looks like a mnemonic", () => {
      mockUseSession.mockReturnValue(makeSession());
      // Even if the hook were to return a non-idle state, the gate in
      // LoginModal hides the preview region for mnemonic-shaped input.
      mockUseWifPreview.mockReturnValue({ status: "checking" });
      render(<LoginModal open onClose={vi.fn()} />);
      fireEvent.change(screen.getByPlaceholderText(/mnemonic phrase/i), {
        target: { value: "two words here" },
      });
      expect(screen.queryByTestId("wif-preview")).toBeNull();
    });
  });
});
