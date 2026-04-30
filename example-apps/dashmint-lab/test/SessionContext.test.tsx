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
  mockFetchContractOwnerId,
  mockFetchBalance,
  mockLoadStoredContractId,
  mockSaveContractId,
  mockClearStoredContractId,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockIdentityKeyManagerCreate: vi.fn(),
  mockFetchContractOwnerId: vi.fn(),
  mockFetchBalance: vi.fn(),
  mockLoadStoredContractId: vi.fn(),
  mockSaveContractId: vi.fn(),
  mockClearStoredContractId: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

// SessionContext dynamic-imports the SDK core module directly (not via the
// app's client.ts/keyManager.ts wrappers), so mock that module instead.
vi.mock("../../../setupDashClient-core.mjs", () => ({
  createClient: mockCreateClient,
  IdentityKeyManager: {
    create: mockIdentityKeyManagerCreate,
  },
}));

vi.mock("../src/dash/contractStorage", () => ({
  DEFAULT_CONTRACT_ID: "default-contract-id",
  fetchContractOwnerId: mockFetchContractOwnerId,
  loadStoredContractId: mockLoadStoredContractId,
  saveContractId: mockSaveContractId,
  clearStoredContractId: mockClearStoredContractId,
}));

/**
 * Fake connected SDK returned by mockCreateClient.
 * Carries the `sdk: "connected"` sentinel (asserted by fetchContractOwnerId
 * cases) AND a mocked `identities.balance` so the post-login balance effect
 * has a callable method.
 */
const fakeSdk = {
  sdk: "connected" as const,
  identities: { balance: mockFetchBalance, nonce: vi.fn() },
};

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

function SessionProbe() {
  const session = useSession();

  return (
    <div>
      <div data-testid="status">{session.status}</div>
      <div data-testid="error">{session.error ?? ""}</div>
      <div data-testid="identity">{session.identityId ?? ""}</div>
      <div data-testid="contract">{session.contractId ?? ""}</div>
      <div data-testid="owner">{session.contractOwnerId ?? ""}</div>
      <div data-testid="balance">
        {session.balance === null ? "" : session.balance.toString()}
      </div>
      <button type="button" onClick={() => session.refreshBalance()}>
        Refresh Balance
      </button>
      <button
        type="button"
        onClick={() => {
          void session.browseOnly();
        }}
      >
        Browse
      </button>
      <button
        type="button"
        onClick={() => {
          void session.login("  test mnemonic  ", 2).catch(() => {});
        }}
      >
        Login
      </button>
      <button
        type="button"
        onClick={() => {
          void session.login("   ").catch(() => {});
        }}
      >
        Empty Login
      </button>
      <button type="button" onClick={() => session.logout()}>
        Logout
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

function renderSession() {
  return render(
    <SessionProvider>
      <SessionProbe />
    </SessionProvider>,
  );
}

beforeEach(() => {
  mockLoadStoredContractId.mockReturnValue("stored-contract-id");
  mockCreateClient.mockReset();
  mockIdentityKeyManagerCreate.mockReset();
  mockFetchContractOwnerId.mockReset();
  mockFetchBalance.mockReset();
  mockFetchBalance.mockResolvedValue(0n);
  mockSaveContractId.mockReset();
  mockClearStoredContractId.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SessionProvider", () => {
  it("connects in browse-only mode and resolves the contract owner", async () => {
    mockCreateClient.mockResolvedValue(fakeSdk);
    mockFetchContractOwnerId.mockResolvedValue("owner-123");

    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "Browse" }));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("browsing");
    });

    expect(mockCreateClient).toHaveBeenCalledWith("testnet");
    await waitFor(() => {
      expect(mockFetchContractOwnerId).toHaveBeenCalledWith({
        sdk: fakeSdk,
        contractId: "stored-contract-id",
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("owner").textContent).toBe("owner-123");
    });
  });

  it("logs in successfully, trimming the mnemonic and storing identity state", async () => {
    mockCreateClient.mockResolvedValue(fakeSdk);
    mockFetchContractOwnerId.mockResolvedValue("owner-123");
    mockIdentityKeyManagerCreate.mockResolvedValue({
      identityId: "identity-456",
    });

    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("authenticated");
    });

    expect(mockIdentityKeyManagerCreate).toHaveBeenCalledWith({
      sdk: fakeSdk,
      mnemonic: "test mnemonic",
      network: "testnet",
      identityIndex: 2,
    });
    expect(screen.getByTestId("identity").textContent).toBe("identity-456");
  });

  it("captures connection failures in browse-only mode", async () => {
    mockCreateClient.mockRejectedValue(new Error("network down"));

    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "Browse" }));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("error");
    });

    expect(screen.getByTestId("error").textContent).toBe("network down");
    expect(mockToastError).toHaveBeenCalledWith(
      "Connection failed: network down",
    );
  });

  it("captures login failures and exposes the error", async () => {
    mockCreateClient.mockResolvedValue(fakeSdk);
    mockFetchContractOwnerId.mockResolvedValue(null);
    mockIdentityKeyManagerCreate.mockRejectedValue(new Error("bad mnemonic"));

    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("error");
    });

    expect(screen.getByTestId("error").textContent).toBe("bad mnemonic");
    expect(mockToastError).toHaveBeenCalledWith("Login failed: bad mnemonic");
  });

  it("rejects an empty mnemonic before attempting login", async () => {
    renderSession();

    fireEvent.click(screen.getByRole("button", { name: "Empty Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("idle");
    });

    expect(screen.getByTestId("error").textContent).toBe("");
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockIdentityKeyManagerCreate).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("persists contract changes and clears back to the default contract", async () => {
    mockLoadStoredContractId
      .mockReturnValueOnce("stored-contract-id")
      .mockReturnValueOnce("default-contract-id");

    renderSession();

    fireEvent.click(screen.getByRole("button", { name: "Set Contract" }));
    expect(mockSaveContractId).toHaveBeenCalledWith("contract-2");
    expect(screen.getByTestId("contract").textContent).toBe("contract-2");

    fireEvent.click(screen.getByRole("button", { name: "Clear Contract" }));
    expect(mockClearStoredContractId).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByTestId("contract").textContent).toBe(
        "default-contract-id",
      );
    });
  });

  it("logs out back to browsing when an sdk connection exists", async () => {
    mockCreateClient.mockResolvedValue(fakeSdk);
    mockFetchContractOwnerId.mockResolvedValue("owner-123");
    mockIdentityKeyManagerCreate.mockResolvedValue({
      identityId: "identity-456",
    });

    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("authenticated");
    });

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    expect(screen.getByTestId("status").textContent).toBe("browsing");
    expect(screen.getByTestId("identity").textContent).toBe("");
  });

  it("fetches the balance once identityId resolves after login", async () => {
    mockCreateClient.mockResolvedValue(fakeSdk);
    mockFetchContractOwnerId.mockResolvedValue("owner-123");
    mockIdentityKeyManagerCreate.mockResolvedValue({
      identityId: "identity-456",
    });
    mockFetchBalance.mockResolvedValue(12_345n);

    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("balance").textContent).toBe("12345");
    });
    expect(mockFetchBalance).toHaveBeenCalledWith("identity-456");
  });

  it("clears the balance on logout", async () => {
    mockCreateClient.mockResolvedValue(fakeSdk);
    mockFetchContractOwnerId.mockResolvedValue(null);
    mockIdentityKeyManagerCreate.mockResolvedValue({
      identityId: "identity-456",
    });
    mockFetchBalance.mockResolvedValue(99n);

    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("balance").textContent).toBe("99");
    });

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() => {
      expect(screen.getByTestId("balance").textContent).toBe("");
    });
  });

  it("clears the balance when transitioning from authenticated to browse-only", async () => {
    mockCreateClient.mockResolvedValue(fakeSdk);
    mockFetchContractOwnerId.mockResolvedValue(null);
    mockIdentityKeyManagerCreate.mockResolvedValue({
      identityId: "identity-456",
    });
    mockFetchBalance.mockResolvedValue(500n);

    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("balance").textContent).toBe("500");
    });

    fireEvent.click(screen.getByRole("button", { name: "Browse" }));
    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("browsing");
    });
    expect(screen.getByTestId("balance").textContent).toBe("");
  });

  it("refreshBalance() re-runs the fetch", async () => {
    mockCreateClient.mockResolvedValue(fakeSdk);
    mockFetchContractOwnerId.mockResolvedValue(null);
    mockIdentityKeyManagerCreate.mockResolvedValue({
      identityId: "identity-456",
    });
    mockFetchBalance.mockResolvedValueOnce(10n).mockResolvedValueOnce(7n);

    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("balance").textContent).toBe("10");
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh Balance" }));
    await waitFor(() => {
      expect(screen.getByTestId("balance").textContent).toBe("7");
    });
    expect(mockFetchBalance).toHaveBeenCalledTimes(2);
  });
});
