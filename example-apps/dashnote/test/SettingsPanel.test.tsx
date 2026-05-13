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

import { SettingsPanel } from "../src/components/SettingsPanel";

const { mockUseSession, mockRegisterContract, mockClearCachedNotes } =
  vi.hoisted(() => ({
    mockUseSession: vi.fn(),
    mockRegisterContract: vi.fn(),
    mockClearCachedNotes: vi.fn(),
  }));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/dash/contract", () => ({
  registerContract: mockRegisterContract,
}));

vi.mock("../src/lib/notesCache", () => ({
  clearCachedNotes: mockClearCachedNotes,
}));

interface SessionOverrides {
  status?: string;
  identityId?: string | null;
  contractId?: string | null;
  rememberedIdentityId?: string | null;
  dpnsName?: string | null;
  sdk?: unknown;
  keyManager?: unknown;
  setContractId?: ReturnType<typeof vi.fn>;
  forgetIdentity?: ReturnType<typeof vi.fn>;
  logout?: ReturnType<typeof vi.fn>;
  log?: ReturnType<typeof vi.fn>;
}

function makeSession(overrides: SessionOverrides = {}) {
  return {
    status: "authenticated",
    error: null,
    sdk: { documents: {} },
    keyManager: { getAuth: vi.fn() },
    identityId: "id-1234567890",
    contractId: "contract-abc",
    rememberedIdentityId: null,
    dpnsName: null,
    log: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    setContractId: vi.fn(),
    enterReadOnly: vi.fn(),
    viewAsRemembered: vi.fn(),
    forgetIdentity: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockUseSession.mockReset();
  mockRegisterContract.mockReset();
  mockClearCachedNotes.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("SettingsPanel", () => {
  it("renders the identity ID and DPNS caption when authenticated", () => {
    mockUseSession.mockReturnValue(
      makeSession({ identityId: "id-abc", dpnsName: "alice" }),
    );
    render(<SettingsPanel onOpenLogin={vi.fn()} />);
    const block = screen.getByTestId("settings-identity-block");
    expect(within(block).getByText("id-abc")).toBeTruthy();
    expect(within(block).getByText("✓ alice.dash")).toBeTruthy();
  });

  it("omits the DPNS caption when no name is set", () => {
    mockUseSession.mockReturnValue(
      makeSession({ identityId: "id-abc", dpnsName: null }),
    );
    render(<SettingsPanel onOpenLogin={vi.fn()} />);
    const block = screen.getByTestId("settings-identity-block");
    expect(within(block).queryByText(/\.dash$/)).toBeNull();
  });

  it("renders the network indicator as testnet", () => {
    mockUseSession.mockReturnValue(makeSession());
    render(<SettingsPanel onOpenLogin={vi.fn()} />);
    expect(screen.getByText("testnet")).toBeTruthy();
  });

  it("shows an empty state with a Sign in button when not signed in or browsing", () => {
    mockUseSession.mockReturnValue(
      makeSession({ status: "readonly", identityId: null, keyManager: null }),
    );
    const onOpenLogin = vi.fn();
    render(<SettingsPanel onOpenLogin={onOpenLogin} />);
    expect(screen.getByText(/sign in to view/i)).toBeTruthy();
    expect(screen.queryByTestId("settings-identity-block")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(onOpenLogin).toHaveBeenCalled();
  });

  it("hides the danger zone when nothing is remembered", () => {
    mockUseSession.mockReturnValue(makeSession({ rememberedIdentityId: null }));
    render(<SettingsPanel onOpenLogin={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: /forget this device/i }),
    ).toBeNull();
  });

  it("calls session.forgetIdentity when Forget this device is clicked", () => {
    const forgetIdentity = vi.fn();
    mockUseSession.mockReturnValue(
      makeSession({
        rememberedIdentityId: "id-1234567890",
        forgetIdentity,
      }),
    );
    render(<SettingsPanel onOpenLogin={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: /forget this device/i }),
    );
    expect(forgetIdentity).toHaveBeenCalled();
  });

  it("copies the identity ID to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    mockUseSession.mockReturnValue(makeSession({ identityId: "id-xyz" }));
    render(<SettingsPanel onOpenLogin={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /copy identity id/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("id-xyz");
    });
  });

  it("applies a pasted contract ID via session.setContractId", () => {
    const setContractId = vi.fn();
    mockUseSession.mockReturnValue(
      makeSession({ contractId: "old", setContractId }),
    );
    render(<SettingsPanel onOpenLogin={vi.fn()} />);
    const input = screen.getByPlaceholderText(/paste a note contract id/i);
    fireEvent.change(input, { target: { value: " new-contract " } });
    fireEvent.click(screen.getByRole("button", { name: /use this id/i }));
    expect(setContractId).toHaveBeenCalledWith("new-contract");
  });

  it("registers a fresh contract with the session sdk, keyManager, and log", async () => {
    const setContractId = vi.fn();
    const sdk = { documents: {}, marker: "sdk" };
    const keyManager = { getAuth: vi.fn(), marker: "km" };
    const log = vi.fn();
    mockRegisterContract.mockResolvedValue("brand-new-id");
    mockUseSession.mockReturnValue(
      makeSession({ setContractId, sdk, keyManager, log }),
    );
    render(<SettingsPanel onOpenLogin={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: /register a fresh contract/i }),
    );
    await waitFor(() => {
      expect(mockRegisterContract).toHaveBeenCalledWith({
        sdk,
        keyManager,
        log,
      });
    });
    await waitFor(() => {
      expect(setContractId).toHaveBeenCalledWith("brand-new-id");
    });
  });

  it("rejects concurrent register clicks before React disables the button", async () => {
    // Hold the first call open so a second invocation can race past
    // setRegistering(true). The ref guard inside the hook must short-circuit
    // the second call so the SDK only sees one publish.
    let resolveFirst: ((value: string) => void) | undefined;
    mockRegisterContract.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    mockUseSession.mockReturnValue(makeSession({ setContractId: vi.fn() }));
    render(<SettingsPanel onOpenLogin={vi.fn()} />);
    const button = screen.getByRole("button", {
      name: /register a fresh contract/i,
    });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mockRegisterContract).toHaveBeenCalledTimes(1);
    resolveFirst?.("only-id");
    await waitFor(() => {
      expect(mockRegisterContract).toHaveBeenCalledTimes(1);
    });
  });

  it("surfaces a registration failure without switching contracts", async () => {
    const setContractId = vi.fn();
    mockRegisterContract.mockRejectedValue(new Error("Network down"));
    mockUseSession.mockReturnValue(makeSession({ setContractId }));
    render(<SettingsPanel onOpenLogin={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: /register a fresh contract/i }),
    );
    expect(await screen.findByText("Network down")).toBeTruthy();
    expect(setContractId).not.toHaveBeenCalled();
  });

  it("invokes clearCachedNotes with the current identity ID", () => {
    mockUseSession.mockReturnValue(makeSession({ identityId: "id-cache" }));
    render(<SettingsPanel onOpenLogin={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: /clear local cache for this device/i,
      }),
    );
    expect(mockClearCachedNotes).toHaveBeenCalledWith("id-cache");
  });
});
