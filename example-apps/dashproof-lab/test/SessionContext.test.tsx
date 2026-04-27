// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionProvider } from "../src/session/SessionContext";
import { useSession } from "../src/session/useSession";

const {
  mockCreateClient,
  mockIdentityKeyManagerCreate,
  mockLoadStoredContractId,
  mockSaveContractId,
  mockClearStoredContractId,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockIdentityKeyManagerCreate: vi.fn(),
  mockLoadStoredContractId: vi.fn(),
  mockSaveContractId: vi.fn(),
  mockClearStoredContractId: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("../src/dash/client", () => ({
  createClient: mockCreateClient,
}));

vi.mock("../src/dash/keyManager", () => ({
  IdentityKeyManager: {
    create: mockIdentityKeyManagerCreate,
  },
}));

vi.mock("../src/dash/contract", () => ({
  loadStoredContractId: mockLoadStoredContractId,
  saveContractId: mockSaveContractId,
  clearStoredContractId: mockClearStoredContractId,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

function Probe() {
  const session = useSession();
  return (
    <div>
      <div data-testid="status">{session.status}</div>
      <div data-testid="identity">{session.identityId ?? ""}</div>
      <div data-testid="contract">{session.contractId ?? ""}</div>
      <div data-testid="error">{session.error ?? ""}</div>
      <button type="button" onClick={() => void session.enterReadOnly()}>
        Read-only
      </button>
      <button type="button" onClick={() => void session.login("  seed  ", 2)}>
        Login
      </button>
      <button type="button" onClick={() => session.setContractId("contract-2")}>
        Set Contract
      </button>
      <button type="button" onClick={() => session.setContractId(null)}>
        Clear Contract
      </button>
    </div>
  );
}

beforeEach(() => {
  mockCreateClient.mockReset();
  mockIdentityKeyManagerCreate.mockReset();
  mockLoadStoredContractId.mockReset();
  mockSaveContractId.mockReset();
  mockClearStoredContractId.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  mockLoadStoredContractId.mockReturnValue("stored-contract-id");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SessionProvider", () => {
  it("enters read-only mode", async () => {
    const sdk = {};
    mockCreateClient.mockResolvedValue(sdk);

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Read-only" }));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("readonly");
    });
    expect(mockCreateClient).toHaveBeenCalledWith("testnet");
  });

  it("logs in and trims the mnemonic before deriving keys", async () => {
    const sdk = {};
    mockCreateClient.mockResolvedValue(sdk);
    mockIdentityKeyManagerCreate.mockResolvedValue({
      identityId: "identity-2",
    });

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("authenticated");
    });
    expect(mockIdentityKeyManagerCreate).toHaveBeenCalledWith({
      sdk,
      mnemonic: "seed",
      network: "testnet",
      identityIndex: 2,
    });
  });

  it("persists and clears contract IDs through the session API", () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Set Contract" }));
    expect(mockSaveContractId).toHaveBeenCalledWith("contract-2");

    fireEvent.click(screen.getByRole("button", { name: "Clear Contract" }));
    expect(mockClearStoredContractId).toHaveBeenCalled();
  });
});
