// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { useContext, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockKeyManagerCreate } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockKeyManagerCreate: vi.fn(),
}));

vi.mock("../../../setupDashClient-core.mjs", () => ({
  createClient: mockCreateClient,
  IdentityKeyManager: {
    create: mockKeyManagerCreate,
  },
}));

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

const REMEMBERED_KEY = "patchbook-lab.lastIdentityId";

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
  mockCreateClient.mockResolvedValue({ documents: {} });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SessionProvider", () => {
  it("loads the remembered identity ID from localStorage on mount and starts in browsing mode", () => {
    localStorage.setItem(REMEMBERED_KEY, "stored-identity-id");
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

    expect(localStorage.getItem(REMEMBERED_KEY)).toBe("logged-in-identity-id");
    expect(ref.current.rememberedIdentityId).toBe("logged-in-identity-id");
    expect(ref.current.status).toBe("authenticated");
    expect(ref.current.identityId).toBe("logged-in-identity-id");
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

  it("viewAsRemembered enters browsing mode using the stored identity", async () => {
    localStorage.setItem(REMEMBERED_KEY, "stored-identity-id");
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
    localStorage.setItem(REMEMBERED_KEY, "stored-identity-id");
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
    const NOTES_KEY = `patchbook-lab.notes.${REMEMBERED_ID}`;
    localStorage.setItem(REMEMBERED_KEY, REMEMBERED_ID);
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
    expect(localStorage.getItem(REMEMBERED_KEY)).toBe("logged-in-identity-id");
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
});
