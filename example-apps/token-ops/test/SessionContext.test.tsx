// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "../src/dash/client";
import {
  clearStoredContractId,
  loadStoredContractId,
  saveContractId,
} from "../src/dash/contract";
import { IdentityKeyManager } from "../src/dash/keyManager";
import { loginWithPrivateKey } from "../src/dash/loginWithPrivateKey";
import { SessionProvider } from "../src/session/SessionContext";
import { useSession } from "../src/session/useSession";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../src/dash/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("../src/dash/keyManager", () => ({
  IdentityKeyManager: { create: vi.fn() },
}));

vi.mock("../src/dash/loginWithPrivateKey", () => ({
  loginWithPrivateKey: vi.fn(),
}));

vi.mock("../src/dash/contract", () => ({
  clearStoredContractId: vi.fn(),
  loadStoredContractId: vi.fn(),
  saveContractId: vi.fn(),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <SessionProvider>{children}</SessionProvider>
);

describe("SessionProvider", () => {
  beforeEach(() => {
    vi.mocked(loadStoredContractId).mockReturnValue("default-contract");
    vi.mocked(createClient).mockResolvedValue({ contracts: {} } as never);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("requires useSession consumers to be inside the provider", () => {
    expect(() => renderHook(() => useSession())).toThrow(
      "useSession must be used inside <SessionProvider>.",
    );
  });

  it("logs in with a mnemonic and forwards the identity index", async () => {
    vi.mocked(IdentityKeyManager.create).mockResolvedValue({
      identityId: "mnemonic-identity",
    } as never);
    const { result } = renderHook(() => useSession(), { wrapper });

    await act(() =>
      result.current.login("  alpha beta gamma  ", { identityIndex: 4 }),
    );

    expect(createClient).toHaveBeenCalledOnce();
    expect(IdentityKeyManager.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mnemonic: "alpha beta gamma",
        network: "testnet",
        identityIndex: 4,
      }),
    );
    expect(loginWithPrivateKey).not.toHaveBeenCalled();
    expect(result.current.status).toBe("authenticated");
    expect(result.current.identityId).toBe("mnemonic-identity");
  });

  it("logs in with a private key without using the identity index", async () => {
    vi.mocked(loginWithPrivateKey).mockResolvedValue({
      identityId: "wif-identity",
      identityKey: {},
      signer: {},
    } as never);
    const { result } = renderHook(() => useSession(), { wrapper });

    await act(() => result.current.login("private-key", { identityIndex: 9 }));

    expect(IdentityKeyManager.create).not.toHaveBeenCalled();
    expect(loginWithPrivateKey).toHaveBeenCalledWith(
      expect.anything(),
      "private-key",
    );
    expect(result.current.keyManager?.identityId).toBe("wif-identity");
    expect(result.current.identityId).toBe("wif-identity");
    expect(result.current.status).toBe("authenticated");
  });

  it("rejects an empty secret before connecting", async () => {
    const { result } = renderHook(() => useSession(), { wrapper });

    await expect(result.current.login("   ")).rejects.toThrow(
      "Mnemonic or private key is required.",
    );
    expect(createClient).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("surfaces login errors, rethrows them, and can reuse its SDK", async () => {
    vi.mocked(IdentityKeyManager.create)
      .mockResolvedValueOnce({ identityId: "first-identity" } as never)
      .mockRejectedValueOnce(new Error("identity unavailable"));
    const { result } = renderHook(() => useSession(), { wrapper });

    await act(() => result.current.login("alpha beta gamma"));
    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.login("delta epsilon zeta");
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toEqual(new Error("identity unavailable"));
    expect(createClient).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("identity unavailable");
  });

  it("enters read-only mode and reports connection failures", async () => {
    const { result } = renderHook(() => useSession(), { wrapper });

    await act(() => result.current.enterReadOnly());
    expect(result.current.status).toBe("readonly");
    expect(result.current.keyManager).toBeNull();
    expect(result.current.identityId).toBeNull();

    cleanup();
    vi.mocked(createClient).mockRejectedValueOnce(new Error("network down"));
    const failed = renderHook(() => useSession(), { wrapper });
    await act(() => failed.result.current.enterReadOnly());
    expect(failed.result.current.status).toBe("error");
    expect(failed.result.current.error).toBe("network down");
  });

  it("logs out to idle without an SDK and read-only with one", async () => {
    const idle = renderHook(() => useSession(), { wrapper });
    act(() => idle.result.current.logout());
    expect(idle.result.current.status).toBe("idle");

    cleanup();
    const connected = renderHook(() => useSession(), { wrapper });
    await act(() => connected.result.current.enterReadOnly());
    act(() => connected.result.current.logout());
    expect(connected.result.current.status).toBe("readonly");
  });

  it("persists a trimmed contract ID and restores the default when cleared", () => {
    const { result } = renderHook(() => useSession(), { wrapper });

    act(() => result.current.setContractId("  contract-2  "));
    expect(saveContractId).toHaveBeenCalledWith("contract-2");
    expect(result.current.contractId).toBe("contract-2");

    vi.mocked(loadStoredContractId).mockReturnValue("fallback-contract");
    act(() => result.current.setContractId(" "));
    expect(clearStoredContractId).toHaveBeenCalledOnce();
    expect(result.current.contractId).toBe("fallback-contract");
  });
});
