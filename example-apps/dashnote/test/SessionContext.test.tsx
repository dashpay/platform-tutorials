// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { useContext, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateClient,
  mockKeyManagerCreate,
  mockRefreshContractCache,
  mockDpnsUsername,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockKeyManagerCreate: vi.fn(),
  mockRefreshContractCache: vi.fn(),
  mockDpnsUsername: vi.fn(),
}));

vi.mock("../../../setupDashClient-core.mjs", () => ({
  createClient: mockCreateClient,
  IdentityKeyManager: {
    create: mockKeyManagerCreate,
  },
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
    success: vi.fn(),
    error: vi.fn(),
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
    const NOTES_KEY = `dashnote.notes.${REMEMBERED_ID}`;
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
      await ref.current.login("mnemonic", { rememberMe: true });
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
      await ref.current.login("mnemonic");
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
      await ref.current.login("mnemonic");
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
      await ref.current.login("mnemonic");
    });
    expect(ref.current.dpnsName).toBe("alice");

    await act(async () => {
      await ref.current.enterReadOnly();
    });

    expect(ref.current.dpnsName).toBeNull();
    expect(ref.current.identityId).toBeNull();
    expect(ref.current.status).toBe("readonly");
  });
});
