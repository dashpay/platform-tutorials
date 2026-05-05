// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { useContext, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateClient,
  mockKeyManagerCreate,
  mockRefreshContractCache,
  mockDpnsUsername,
  mockResolveDpnsName,
  mockLoginWithPrivateKey,
  mockToastError,
  mockToastSuccess,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockKeyManagerCreate: vi.fn(),
  mockRefreshContractCache: vi.fn(),
  mockDpnsUsername: vi.fn(),
  mockResolveDpnsName: vi.fn(),
  mockLoginWithPrivateKey: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("../../../setupDashClient-core.mjs", () => ({
  createClient: mockCreateClient,
  IdentityKeyManager: {
    create: mockKeyManagerCreate,
  },
}));

vi.mock("../src/dash/loginWithPrivateKey", () => ({
  loginWithPrivateKey: mockLoginWithPrivateKey,
  UnknownIdentityError: class UnknownIdentityError extends Error {},
  WrongKeyPurposeError: class WrongKeyPurposeError extends Error {},
  KeyDisabledError: class KeyDisabledError extends Error {},
  InvalidPrivateKeyError: class InvalidPrivateKeyError extends Error {},
}));

// Default resolver delegates to the real implementation (which calls
// sdk.dpns.username — already mocked via mockDpnsUsername). Specific tests
// override this to make resolveDpnsName itself throw, exercising the outer
// try/catch in SessionContext.
vi.mock("../src/dash/resolveDpnsName", () => ({
  resolveDpnsName: mockResolveDpnsName,
}));

vi.mock("../src/dash/contract", async () => {
  const actual = await vi.importActual<typeof import("../src/dash/contract")>(
    "../src/dash/contract",
  );
  return {
    ...actual,
    refreshContractCache: mockRefreshContractCache,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

import {
  SessionContext,
  SessionProvider,
  type SessionValue,
} from "../src/session/SessionContext";

const REMEMBERED_KEY = "dashnote.lastIdentity";

function Harness({ onValue }: { onValue: (value: SessionValue) => void }) {
  const value = useContext(SessionContext);
  if (value) onValue(value);
  return null;
}

function mountSession(): { current: SessionValue } {
  const ref = { current: null as unknown as SessionValue };
  const handler = (value: SessionValue) => {
    ref.current = value;
  };
  const ui: ReactNode = (
    <SessionProvider>
      <Harness onValue={handler} />
    </SessionProvider>
  );
  render(ui);
  return ref;
}

beforeEach(() => {
  localStorage.clear();
  mockCreateClient.mockReset();
  mockKeyManagerCreate.mockReset();
  mockRefreshContractCache.mockReset();
  mockDpnsUsername.mockReset();
  mockDpnsUsername.mockResolvedValue(null);
  mockCreateClient.mockResolvedValue({
    documents: {},
    dpns: { username: mockDpnsUsername },
  });
  // Default behavior mirrors the real resolveDpnsName: forward to
  // sdk.dpns.username, strip the .dash suffix, and return null on null/empty.
  // Tests that need the resolver to throw outright override this.
  mockToastError.mockReset();
  mockToastSuccess.mockReset();
  mockResolveDpnsName.mockReset();
  mockLoginWithPrivateKey.mockReset();
  mockResolveDpnsName.mockImplementation(async (sdk, identityId) => {
    const result = await sdk.dpns.username(identityId);
    if (typeof result !== "string" || result.length === 0) return null;
    return result.endsWith(".dash") ? result.slice(0, -5) : result;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SessionProvider", () => {
  it("loads the remembered identity ID from localStorage on mount and starts in browsing mode", () => {
    localStorage.setItem(
      REMEMBERED_KEY,
      JSON.stringify({ id: "stored-identity-id" }),
    );
    const ref = mountSession();
    expect(ref.current.rememberedIdentityId).toBe("stored-identity-id");
    expect(ref.current.status).toBe("browsing");
    expect(ref.current.identityId).toBe("stored-identity-id");
  });

  it("starts in idle mode when no identity is remembered", () => {
    const ref = mountSession();
    expect(ref.current.rememberedIdentityId).toBeNull();
    expect(ref.current.status).toBe("idle");
  });

  it("persists the identity ID on login when rememberMe is true", async () => {
    mockKeyManagerCreate.mockResolvedValue({
      identityId: "logged-in-identity-id",
    });
    const ref = mountSession();

    await act(async () => {
      await ref.current.login("test mnemonic", { rememberMe: true });
    });

    expect(JSON.parse(localStorage.getItem(REMEMBERED_KEY) ?? "null")).toEqual({
      id: "logged-in-identity-id",
      name: null,
    });
    expect(ref.current.rememberedIdentityId).toBe("logged-in-identity-id");
    expect(ref.current.status).toBe("authenticated");
    expect(ref.current.identityId).toBe("logged-in-identity-id");
    expect(ref.current.dpnsName).toBeNull();
  });

  it("persists the resolved DPNS name alongside the identity on login", async () => {
    mockKeyManagerCreate.mockResolvedValue({
      identityId: "logged-in-identity-id",
    });
    mockDpnsUsername.mockResolvedValue("alice.dash");
    const ref = mountSession();

    await act(async () => {
      await ref.current.login("test mnemonic", { rememberMe: true });
    });

    expect(JSON.parse(localStorage.getItem(REMEMBERED_KEY) ?? "null")).toEqual({
      id: "logged-in-identity-id",
      name: "alice",
    });
    expect(ref.current.dpnsName).toBe("alice");
  });

  it("does not persist on login when rememberMe is false", async () => {
    mockKeyManagerCreate.mockResolvedValue({
      identityId: "logged-in-identity-id",
    });
    const ref = mountSession();

    await act(async () => {
      await ref.current.login("test mnemonic");
    });

    expect(localStorage.getItem(REMEMBERED_KEY)).toBeNull();
    expect(ref.current.rememberedIdentityId).toBeNull();
    expect(ref.current.status).toBe("authenticated");
  });

  it("clears a previously remembered identity when login uses rememberMe: false", async () => {
    // Pre-seed a remembered identity from an earlier session, then log in
    // with the box unchecked. The new identity must NOT be persisted, and
    // the previously-remembered identity must be wiped — otherwise logout
    // falls back to the wrong identity.
    localStorage.setItem(
      REMEMBERED_KEY,
      JSON.stringify({ id: "previously-remembered-id", name: "alice" }),
    );
    mockKeyManagerCreate.mockResolvedValue({
      identityId: "newly-logged-in-id",
    });
    const ref = mountSession();
    expect(ref.current.rememberedIdentityId).toBe("previously-remembered-id");

    await act(async () => {
      await ref.current.login("test mnemonic", { rememberMe: false });
    });

    expect(localStorage.getItem(REMEMBERED_KEY)).toBeNull();
    expect(ref.current.rememberedIdentityId).toBeNull();
    expect(ref.current.status).toBe("authenticated");
    expect(ref.current.identityId).toBe("newly-logged-in-id");
  });

  it("completes login when DPNS resolution rejects (caption is optional)", async () => {
    mockKeyManagerCreate.mockResolvedValue({
      identityId: "logged-in-identity-id",
    });
    // Make resolveDpnsName itself throw, escaping its internal try/catch
    // (e.g., a future refactor removes the swallow, or sdk.dpns is missing).
    // The session must still reach authenticated state with dpnsName=null.
    mockResolveDpnsName.mockRejectedValue(new Error("DPNS service down"));
    const ref = mountSession();

    await act(async () => {
      await ref.current.login("test mnemonic", { rememberMe: true });
    });

    expect(ref.current.status).toBe("authenticated");
    expect(ref.current.error).toBeNull();
    expect(ref.current.dpnsName).toBeNull();
    // Identity is still persisted — just without the optional name caption.
    expect(JSON.parse(localStorage.getItem(REMEMBERED_KEY) ?? "null")).toEqual({
      id: "logged-in-identity-id",
      name: null,
    });
    // No error toast: a missing name is not a session failure.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("hydrates dpnsName from the remembered identity record on mount", () => {
    localStorage.setItem(
      REMEMBERED_KEY,
      JSON.stringify({ id: "stored-identity-id", name: "alice" }),
    );
    const ref = mountSession();
    expect(ref.current.dpnsName).toBe("alice");
  });

  it("viewAsRemembered skips the DPNS lookup when a name is already cached", async () => {
    localStorage.setItem(
      REMEMBERED_KEY,
      JSON.stringify({ id: "stored-identity-id", name: "alice" }),
    );
    const ref = mountSession();

    await act(async () => {
      await ref.current.viewAsRemembered();
    });

    expect(mockDpnsUsername).not.toHaveBeenCalled();
    expect(ref.current.dpnsName).toBe("alice");
  });

  it("viewAsRemembered resolves and persists the DPNS name when none is cached", async () => {
    localStorage.setItem(
      REMEMBERED_KEY,
      JSON.stringify({ id: "stored-identity-id" }),
    );
    mockDpnsUsername.mockResolvedValue("alice.dash");
    const ref = mountSession();

    await act(async () => {
      await ref.current.viewAsRemembered();
    });

    expect(mockDpnsUsername).toHaveBeenCalledWith("stored-identity-id");
    expect(ref.current.dpnsName).toBe("alice");
    expect(JSON.parse(localStorage.getItem(REMEMBERED_KEY) ?? "null")).toEqual({
      id: "stored-identity-id",
      name: "alice",
    });
  });

  it("viewAsRemembered enters browsing mode using the stored identity", async () => {
    localStorage.setItem(
      REMEMBERED_KEY,
      JSON.stringify({ id: "stored-identity-id" }),
    );
    const ref = mountSession();

    await act(async () => {
      await ref.current.viewAsRemembered();
    });

    expect(ref.current.status).toBe("browsing");
    expect(ref.current.identityId).toBe("stored-identity-id");
    expect(ref.current.keyManager).toBeNull();
  });

  it("viewAsRemembered falls back to read-only when nothing is stored", async () => {
    const ref = mountSession();

    await act(async () => {
      await ref.current.viewAsRemembered();
    });

    expect(ref.current.status).toBe("readonly");
    expect(ref.current.identityId).toBeNull();
  });

  it("forgetIdentity clears storage and drops browsing back to readonly", async () => {
    localStorage.setItem(
      REMEMBERED_KEY,
      JSON.stringify({ id: "stored-identity-id" }),
    );
    const ref = mountSession();

    await act(async () => {
      await ref.current.viewAsRemembered();
    });
    expect(ref.current.status).toBe("browsing");

    act(() => {
      ref.current.forgetIdentity();
    });

    expect(localStorage.getItem(REMEMBERED_KEY)).toBeNull();
    expect(ref.current.rememberedIdentityId).toBeNull();
    expect(ref.current.status).toBe("readonly");
    expect(ref.current.identityId).toBeNull();
  });

  it("forgetIdentity also evicts the remembered identity's note cache", async () => {
    const REMEMBERED_ID = "stored-identity-id";
    const NOTES_KEY = `dashnote.notes.${REMEMBERED_ID}.contract-1.testnet`;
    localStorage.setItem(REMEMBERED_KEY, JSON.stringify({ id: REMEMBERED_ID }));
    localStorage.setItem(
      NOTES_KEY,
      JSON.stringify({
        version: 1,
        identityId: REMEMBERED_ID,
        contractId: "contract-1",
        network: "testnet",
        cachedAt: Date.now(),
        notes: [],
      }),
    );

    const ref = mountSession();
    await act(async () => {
      await ref.current.viewAsRemembered();
    });

    act(() => {
      ref.current.forgetIdentity();
    });

    expect(localStorage.getItem(REMEMBERED_KEY)).toBeNull();
    expect(localStorage.getItem(NOTES_KEY)).toBeNull();
  });

  it("logout retains the remembered identity and transitions to browsing", async () => {
    mockKeyManagerCreate.mockResolvedValue({
      identityId: "logged-in-identity-id",
    });
    const ref = mountSession();

    await act(async () => {
      await ref.current.login("test mnemonic", { rememberMe: true });
    });
    expect(ref.current.status).toBe("authenticated");

    act(() => {
      ref.current.logout();
    });

    expect(ref.current.status).toBe("browsing");
    expect(ref.current.identityId).toBe("logged-in-identity-id");
    expect(ref.current.keyManager).toBeNull();
    expect(
      JSON.parse(localStorage.getItem(REMEMBERED_KEY) ?? "null"),
    ).toMatchObject({ id: "logged-in-identity-id" });
  });

  it("setContractId evicts the previous contract from the SDK cache when the ID changes", async () => {
    localStorage.setItem("dashnote.contractId", "old-contract-id");
    const ref = mountSession();
    await act(async () => {
      await ref.current.viewAsRemembered();
    });
    mockRefreshContractCache.mockClear();

    act(() => {
      ref.current.setContractId("new-contract-id");
    });

    expect(mockRefreshContractCache).toHaveBeenCalledTimes(1);
    expect(mockRefreshContractCache).toHaveBeenCalledWith({
      sdk: expect.anything(),
      contractId: "old-contract-id",
    });
  });

  it("setContractId does not evict when the new ID equals the current ID", async () => {
    localStorage.setItem("dashnote.contractId", "same-contract-id");
    const ref = mountSession();
    await act(async () => {
      await ref.current.viewAsRemembered();
    });
    mockRefreshContractCache.mockClear();

    act(() => {
      ref.current.setContractId("same-contract-id");
    });

    expect(mockRefreshContractCache).not.toHaveBeenCalled();
  });

  it("logout falls back to readonly when no identity is remembered", async () => {
    mockKeyManagerCreate.mockResolvedValue({
      identityId: "logged-in-identity-id",
    });
    const ref = mountSession();

    await act(async () => {
      await ref.current.login("test mnemonic");
    });

    act(() => {
      ref.current.logout();
    });

    expect(ref.current.status).toBe("readonly");
    expect(ref.current.identityId).toBeNull();
  });

  it("logout clears dpnsName when no identity is remembered", async () => {
    mockKeyManagerCreate.mockResolvedValue({
      identityId: "logged-in-identity-id",
    });
    mockDpnsUsername.mockResolvedValue("alice.dash");
    const ref = mountSession();

    await act(async () => {
      await ref.current.login("test mnemonic");
    });
    expect(ref.current.dpnsName).toBe("alice");

    act(() => {
      ref.current.logout();
    });

    expect(ref.current.dpnsName).toBeNull();
  });

  it("forgetIdentity clears the cached dpnsName", async () => {
    localStorage.setItem(
      REMEMBERED_KEY,
      JSON.stringify({ id: "stored-identity-id", name: "alice" }),
    );
    const ref = mountSession();
    expect(ref.current.dpnsName).toBe("alice");

    act(() => {
      ref.current.forgetIdentity();
    });

    expect(ref.current.dpnsName).toBeNull();
  });

  it("enterReadOnly clears any prior dpnsName because readonly has no identity", async () => {
    mockKeyManagerCreate.mockResolvedValue({
      identityId: "logged-in-identity-id",
    });
    mockDpnsUsername.mockResolvedValue("alice.dash");
    const ref = mountSession();

    await act(async () => {
      await ref.current.login("test mnemonic");
    });
    expect(ref.current.dpnsName).toBe("alice");

    await act(async () => {
      await ref.current.enterReadOnly();
    });

    expect(ref.current.dpnsName).toBeNull();
    expect(ref.current.identityId).toBeNull();
    expect(ref.current.status).toBe("readonly");
  });

  it("dispatches a WIF input to loginWithPrivateKey, not IdentityKeyManager", async () => {
    mockLoginWithPrivateKey.mockResolvedValue({
      identityId: "wif-identity-id",
      identity: { id: "wif-identity-id" },
      identityKey: { mock: "key" },
      signer: { mock: "signer" },
    });
    const ref = mountSession();

    await act(async () => {
      await ref.current.login("cVHcfvcWNc7DvqaPCwM6Z3", { rememberMe: true });
    });

    expect(mockLoginWithPrivateKey).toHaveBeenCalledTimes(1);
    expect(mockKeyManagerCreate).not.toHaveBeenCalled();
    expect(ref.current.status).toBe("authenticated");
    expect(ref.current.identityId).toBe("wif-identity-id");
    expect(ref.current.keyManager?.identityId).toBe("wif-identity-id");
  });

  it("failed WIF login from idle returns to idle without clobbering identity state", async () => {
    mockLoginWithPrivateKey.mockRejectedValue(
      new Error("Found identity X, but this is a transfer key."),
    );
    const ref = mountSession();
    expect(ref.current.status).toBe("idle");

    await act(async () => {
      await ref.current.login("cVHcfvcWNc7DvqaPCwM6Z3").catch(() => undefined);
    });

    expect(ref.current.status).toBe("idle");
    expect(ref.current.keyManager).toBeNull();
    expect(ref.current.identityId).toBeNull();
    expect(ref.current.error).toMatch(/transfer key/);
    // Assert the precise message reaches the toast — guards against a
    // future refactor swallowing it into a generic "Login failed".
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining("transfer key"),
    );
  });

  it("failed login from authenticated without rememberMe restores authenticated state", async () => {
    // Locks in the snapshot/restore branch for the case where no
    // remembered identity exists. Without the snapshot/restore, a failed
    // key-swap from an authenticated session would log the user out.
    mockKeyManagerCreate.mockResolvedValueOnce({
      identityId: "logged-in-id",
    });
    const ref = mountSession();
    await act(async () => {
      await ref.current.login("test mnemonic", { rememberMe: false });
    });
    expect(ref.current.status).toBe("authenticated");
    const priorKeyManager = ref.current.keyManager;
    expect(priorKeyManager).not.toBeNull();
    expect(ref.current.rememberedIdentityId).toBeNull();

    mockLoginWithPrivateKey.mockRejectedValueOnce(
      new Error("Found identity Y, but this is a transfer key."),
    );
    await act(async () => {
      await ref.current.login("cVHcfvcWNc7DvqaPCwM6Z3").catch(() => undefined);
    });

    expect(ref.current.status).toBe("authenticated");
    expect(ref.current.identityId).toBe("logged-in-id");
    expect(ref.current.keyManager).toBe(priorKeyManager);
    expect(ref.current.rememberedIdentityId).toBeNull();
    expect(ref.current.error).toMatch(/transfer key/);
  });

  it("failed WIF login from browsing keeps the remembered identity panel intact", async () => {
    // Reproduces the screenshot bug: a wrong-purpose key while browsing
    // a remembered identity should NOT log the user out.
    localStorage.setItem(
      REMEMBERED_KEY,
      JSON.stringify({ id: "remembered-id", name: "alice" }),
    );
    mockLoginWithPrivateKey.mockRejectedValue(
      new Error("Found identity X, but this is a transfer key."),
    );
    const ref = mountSession();
    expect(ref.current.status).toBe("browsing");

    await act(async () => {
      await ref.current.login("cVHcfvcWNc7DvqaPCwM6Z3").catch(() => undefined);
    });

    expect(ref.current.status).toBe("browsing");
    expect(ref.current.identityId).toBe("remembered-id");
    expect(ref.current.dpnsName).toBe("alice");
    expect(ref.current.rememberedIdentityId).toBe("remembered-id");
    expect(ref.current.keyManager).toBeNull();
    expect(ref.current.error).toMatch(/transfer key/);
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining("transfer key"),
    );
  });

  it("failed switch-identity from authenticated falls back to browsing the remembered identity", async () => {
    // First, authenticate so a real keyManager + remembered identity exist.
    mockKeyManagerCreate.mockResolvedValueOnce({
      identityId: "logged-in-id",
    });
    const ref = mountSession();
    await act(async () => {
      await ref.current.login("test mnemonic", { rememberMe: true });
    });
    expect(ref.current.status).toBe("authenticated");
    expect(ref.current.keyManager).not.toBeNull();

    // Now attempt to switch with a wrong-purpose WIF. The active session
    // should drop, but a remembered identity exists, so we land in browsing.
    mockLoginWithPrivateKey.mockRejectedValueOnce(
      new Error("Found identity Y, but this is a transfer key."),
    );
    await act(async () => {
      await ref.current.login("cVHcfvcWNc7DvqaPCwM6Z3").catch(() => undefined);
    });

    expect(ref.current.status).toBe("browsing");
    expect(ref.current.identityId).toBe("logged-in-id");
    expect(ref.current.keyManager).toBeNull();
    expect(ref.current.error).toMatch(/transfer key/);
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining("transfer key"),
    );
  });

  it("failed mnemonic login from idle restores idle state (not just the WIF path)", async () => {
    mockKeyManagerCreate.mockRejectedValue(new Error("Bad mnemonic checksum."));
    const ref = mountSession();
    expect(ref.current.status).toBe("idle");

    await act(async () => {
      await ref.current
        .login("not a real mnemonic phrase")
        .catch(() => undefined);
    });

    expect(ref.current.status).toBe("idle");
    expect(ref.current.keyManager).toBeNull();
    expect(ref.current.identityId).toBeNull();
    expect(ref.current.error).toMatch(/checksum/);
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining("checksum"),
    );
  });
});
