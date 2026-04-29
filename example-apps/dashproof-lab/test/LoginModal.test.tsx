// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
  contractId?: string | null;
  identityId?: string | null;
  sdk?: unknown;
  keyManager?: unknown;
  login?: ReturnType<typeof vi.fn>;
  logout?: ReturnType<typeof vi.fn>;
  setContractId?: ReturnType<typeof vi.fn>;
  log?: ReturnType<typeof vi.fn>;
}

function makeSession(overrides: SessionOverrides = {}) {
  return {
    status: "readonly",
    error: null,
    sdk: { documents: {} },
    keyManager: null,
    identityId: null,
    contractId: null,
    log: vi.fn(),
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    setContractId: vi.fn(),
    enterReadOnly: vi.fn().mockResolvedValue(undefined),
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
    const { container } = render(
      <LoginModal open={false} onClose={vi.fn()} />,
    );
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
    fireEvent.click(
      screen.getByRole("button", { name: /login and continue/i }),
    );

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("test mnemonic phrase", 0);
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
    fireEvent.click(
      screen.getByRole("button", { name: /login and continue/i }),
    );

    expect(await screen.findByText("Bad mnemonic")).toBeTruthy();
  });

  it("disables the login button while the mnemonic field is empty", () => {
    mockUseSession.mockReturnValue(makeSession());

    render(<LoginModal open onClose={vi.fn()} />);

    const button = screen.getByRole("button", {
      name: /login and continue/i,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("uses identity index from advanced settings", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    mockUseSession.mockReturnValue(makeSession({ login }));

    render(<LoginModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByText(/advanced settings/i));
    fireEvent.change(screen.getByLabelText(/identity index/i), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByPlaceholderText(/mnemonic phrase/i), {
      target: { value: "phrase" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /login and continue/i }),
    );

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("phrase", 3);
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

    expect(screen.getByText(/identity/i)).toBeTruthy();
    expect(screen.getByText("id-123456789012345678")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^logout$/i }));
    expect(logout).toHaveBeenCalled();
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

    fireEvent.click(screen.getByRole("button", { name: /register new/i }));

    await waitFor(() => {
      expect(mockRegisterContract).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(setContractId).toHaveBeenCalledWith("new-contract-id");
    });
  });
});
