// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SessionProvider } from "../src/session/SessionContext";
import { useSession } from "../src/session/useSession";
import { loadSdkCore } from "../src/dash/sdkCore";
import { deferred, id, sdk } from "./helpers";
vi.mock("../src/dash/sdkCore", () => ({ loadSdkCore: vi.fn() }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});
function setup() {
  const client = { ...sdk(), identities: { balance: vi.fn(async () => 500n) } };
  const manager = { identityId: id(1), getAuth: vi.fn() };
  const create = vi.fn(async () => manager);
  const connect = vi.fn(async () => client);
  vi.mocked(loadSdkCore).mockResolvedValue({
    createClient: connect,
    IdentityKeyManager: { create },
  } as unknown as Awaited<ReturnType<typeof loadSdkCore>>);
  const hook = renderHook(() => useSession(), { wrapper: SessionProvider });
  return { ...hook, client, create, manager, connect };
}
it("signs in on testnet without persisting credentials and signs out", async () => {
  const { result, create, client } = setup();
  vi.mocked(client.dpns.username).mockResolvedValue("alice.dash");
  await waitFor(() => expect(result.current.status).toBe("readonly"));
  await act(async () => {
    await result.current.login("test-only phrase", 2);
  });
  expect(result.current).toMatchObject({
    status: "authenticated",
    identityId: id(1),
    identityName: "alice",
    balance: 500n,
  });
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      network: "testnet",
      identityIndex: 2,
      mnemonic: "test-only phrase",
    }),
  );
  expect(localStorage.length).toBe(0);
  act(() => result.current.logout());
  expect(result.current.keyManager).toBeNull();
  expect(result.current.identityId).toBeNull();
});
it("ignores a stored mainnet preference", async () => {
  localStorage.setItem("dashapps.network", "mainnet");
  const { result, connect } = setup();
  await waitFor(() => expect(result.current.status).toBe("readonly"));
  expect(result.current.network).toBe("testnet");
  expect(connect).toHaveBeenCalledWith("testnet");
});
it.each(["network", "logout", "registry"] as const)(
  "cancels late authentication after %s changes",
  async (change) => {
    const { result, create, manager } = setup();
    const pending = deferred<typeof manager>();
    create.mockReturnValue(pending.promise);
    await waitFor(() => expect(result.current.status).toBe("readonly"));
    let login!: Promise<void>;
    act(() => {
      login = result.current.login("test-only phrase");
    });
    const rejected = expect(login).rejects.toThrow("cancelled");
    await waitFor(() => expect(create).toHaveBeenCalled());
    act(() => {
      if (change === "network") result.current.setNetwork("mainnet");
      else if (change === "logout") result.current.logout();
      else result.current.setRegistryId(id(9));
    });
    await act(async () => {
      pending.resolve(manager);
      await rejected;
    });
    expect(result.current.keyManager).toBeNull();
  },
);
it("discards a balance refresh after logout", async () => {
  const { result, client } = setup();
  await waitFor(() => expect(result.current.status).toBe("readonly"));
  await act(async () => result.current.login("test-only phrase"));
  const pending = deferred<bigint>();
  client.identities.balance.mockReturnValue(pending.promise);
  let refreshing!: Promise<void>;
  act(() => {
    refreshing = result.current.refreshBalance();
    result.current.logout();
  });
  await act(async () => {
    pending.resolve(999n);
    await refreshing;
  });
  expect(result.current.balance).toBeNull();
});
it("keeps network registry overrides in memory when persistence is denied", async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current.status).toBe("readonly"));
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("denied");
  });
  act(() => {
    expect(result.current.setRegistryId(id(7))).toBe(false);
  });
  expect(result.current.registryGeneration).toBe(1);
  act(() => result.current.setNetwork("mainnet"));
  expect(result.current.registryId).toBe("");
  act(() => result.current.setRegistryId(id(8)));
  act(() => result.current.setNetwork("testnet"));
  expect(result.current.registryId).toBe(id(7));
});
it("rejects invalid identity indices before key derivation", async () => {
  const { result, create } = setup();
  await waitFor(() => expect(result.current.status).toBe("readonly"));
  for (const index of [-1, 0.5, NaN, 2147483648])
    await expect(
      result.current.login("test-only phrase", index),
    ).rejects.toThrow("Identity index");
  expect(create).not.toHaveBeenCalled();
});
