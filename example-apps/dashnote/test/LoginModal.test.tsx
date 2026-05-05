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

const { mockUseSession, mockRegisterContract } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockRegisterContract: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/dash/contract", () => ({
  registerContract: mockRegisterContract,
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
  mockRegisterContract.mockReset();
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

  it("submits the mnemonic via session.login and closes on success", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    mockUseSession.mockReturnValue(makeSession({ login }));

    render(<LoginModal open onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText(/mnemonic phrase/i), {
      target: { value: "test mnemonic phrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^login$/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /^login$/i }));

    expect(await screen.findByText("Bad mnemonic")).toBeTruthy();
  });

  it("disables the login button while the mnemonic field is empty", () => {
    mockUseSession.mockReturnValue(makeSession());

    render(<LoginModal open onClose={vi.fn()} />);

    const button = screen.getByRole("button", {
      name: /^login$/i,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
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
    fireEvent.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("phrase", {
        identityIndex: 3,
        rememberMe: true,
      });
    });
  });

  it("shows the settings view with logout when authenticated", () => {
    const logout = vi.fn();
    mockUseSession.mockReturnValue(
      makeSession({
        status: "authenticated",
        identityId: "id-123456789012345678",
        contractId: "contract-abc",
        keyManager: { getAuth: vi.fn() },
        logout,
      }),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    expect(screen.getByText("id-123456789012345678")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^logout$/i }));
    expect(logout).toHaveBeenCalled();
  });

  it("applies a pasted contract ID immediately without validation", () => {
    const setContractId = vi.fn();
    mockUseSession.mockReturnValue(
      makeSession({
        status: "authenticated",
        identityId: "id-1",
        contractId: null,
        keyManager: { getAuth: vi.fn() },
        setContractId,
      }),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByText(/advanced settings/i));
    fireEvent.change(
      screen.getByPlaceholderText(
        /paste a note contract id or register a new one/i,
      ),
      {
        target: { value: " contract-123 " },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: /use this id/i }));

    expect(setContractId).toHaveBeenCalledWith("contract-123");
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
    fireEvent.click(screen.getByRole("button", { name: /^login$/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /^login$/i }));

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
      /enter the mnemonic phrase or private key for this identity/i,
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
      /enter the mnemonic phrase or private key for this identity/i,
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

  it("calls forgetIdentity when Forget this device is clicked from the login form", () => {
    const forgetIdentity = vi.fn();
    mockUseSession.mockReturnValue(
      makeSession({
        rememberedIdentityId: "remembered-identity-id",
        forgetIdentity,
      }),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: /forget this device/i }),
    );
    expect(forgetIdentity).toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole("button", { name: /^login$/i }));

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

  it("settings panel shows the DPNS name as a ✓ name.dash caption under the identity", () => {
    mockUseSession.mockReturnValue(
      makeSession({
        status: "authenticated",
        identityId: "id-1",
        dpnsName: "alice",
        keyManager: { getAuth: vi.fn() },
      }),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    const block = screen.getByTestId("settings-identity-block");
    expect(within(block).getByText("✓ alice.dash")).toBeTruthy();
  });

  it("settings panel omits the DPNS caption when no name is set", () => {
    mockUseSession.mockReturnValue(
      makeSession({
        status: "authenticated",
        identityId: "id-1",
        dpnsName: null,
        keyManager: { getAuth: vi.fn() },
      }),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    const block = screen.getByTestId("settings-identity-block");
    expect(within(block).queryByText(/\.dash$/)).toBeNull();
  });

  it("settings: Use a different identity link calls session.logout", () => {
    const logout = vi.fn();
    mockUseSession.mockReturnValue(
      makeSession({
        status: "authenticated",
        identityId: "id-1",
        keyManager: { getAuth: vi.fn() },
        logout,
      }),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    const actions = screen.getByTestId("settings-identity-actions");
    fireEvent.click(
      within(actions).getByRole("button", {
        name: /use a different identity/i,
      }),
    );
    expect(logout).toHaveBeenCalled();
  });

  it("settings: Forget this device link calls session.forgetIdentity when remembered", () => {
    const forgetIdentity = vi.fn();
    mockUseSession.mockReturnValue(
      makeSession({
        status: "authenticated",
        identityId: "id-1",
        rememberedIdentityId: "id-1",
        keyManager: { getAuth: vi.fn() },
        forgetIdentity,
      }),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    const actions = screen.getByTestId("settings-identity-actions");
    fireEvent.click(
      within(actions).getByRole("button", { name: /forget this device/i }),
    );
    expect(forgetIdentity).toHaveBeenCalled();
  });

  it("settings: Forget this device link is hidden when nothing is remembered", () => {
    mockUseSession.mockReturnValue(
      makeSession({
        status: "authenticated",
        identityId: "id-1",
        rememberedIdentityId: null,
        keyManager: { getAuth: vi.fn() },
      }),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    const actions = screen.getByTestId("settings-identity-actions");
    expect(
      within(actions).queryByRole("button", { name: /forget this device/i }),
    ).toBeNull();
  });

  it("settings: Close button calls onClose without logging out", () => {
    const onClose = vi.fn();
    const logout = vi.fn();
    mockUseSession.mockReturnValue(
      makeSession({
        status: "authenticated",
        identityId: "id-1",
        keyManager: { getAuth: vi.fn() },
        logout,
      }),
    );

    render(<LoginModal open onClose={onClose} />);

    const closeButtons = screen.getAllByRole("button", {
      name: /^close$/i,
    });
    const inlineClose = closeButtons.find(
      (button) => button.textContent === "Close",
    );
    expect(inlineClose).toBeDefined();
    fireEvent.click(inlineClose!);
    expect(onClose).toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });

  it("settings: Logout button also calls onClose", () => {
    const onClose = vi.fn();
    const logout = vi.fn();
    mockUseSession.mockReturnValue(
      makeSession({
        status: "authenticated",
        identityId: "id-1",
        keyManager: { getAuth: vi.fn() },
        logout,
      }),
    );

    render(<LoginModal open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /^logout$/i }));
    expect(logout).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("registers a new contract when the Register new button is clicked", async () => {
    const setContractId = vi.fn();
    mockRegisterContract.mockResolvedValue("new-contract-id");
    mockUseSession.mockReturnValue(
      makeSession({
        status: "authenticated",
        identityId: "id-1",
        keyManager: { getAuth: vi.fn() },
        setContractId,
      }),
    );

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByText(/advanced settings/i));
    fireEvent.click(screen.getByRole("button", { name: /register new/i }));

    await waitFor(() => {
      expect(mockRegisterContract).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(setContractId).toHaveBeenCalledWith("new-contract-id");
    });
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

  it("hides the identity-index field when the input parses as a WIF", () => {
    mockUseSession.mockReturnValue(makeSession());
    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/mnemonic phrase/i), {
      target: { value: "cVHcfvcWNc7DvqaPCwM6Z3DqZ" },
    });
    fireEvent.click(screen.getByText(/advanced settings/i));

    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("forwards a WIF input verbatim to session.login", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    mockUseSession.mockReturnValue(makeSession({ login }));

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/mnemonic phrase/i), {
      target: { value: "cVHcfvcWNc7DvqaPCwM6Z3DqZ" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^login$/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("cVHcfvcWNc7DvqaPCwM6Z3DqZ", {
        identityIndex: 0,
        rememberMe: true,
      });
    });
  });
});
