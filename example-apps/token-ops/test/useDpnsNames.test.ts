// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { lookupDpnsName } from "../src/dash/resolveDpnsName";
import { useDpnsNames } from "../src/hooks/useDpnsNames";

vi.mock("../src/dash/resolveDpnsName", () => ({
  lookupDpnsName: vi.fn(),
}));

const sdk = { identities: {} } as never;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("useDpnsNames", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("normalizes, sorts, and deduplicates identity IDs before lookup", async () => {
    vi.mocked(lookupDpnsName).mockImplementation(
      async (_sdk, id) => `name-for-${id}`,
    );

    const { result } = renderHook(() =>
      useDpnsNames(sdk, [" id-b ", null, "id-a", "id-b", "  "]),
    );

    await waitFor(() =>
      expect(result.current).toEqual({
        "id-a": "name-for-id-a",
        "id-b": "name-for-id-b",
      }),
    );
    expect(vi.mocked(lookupDpnsName).mock.calls.map((call) => call[1])).toEqual(
      ["id-a", "id-b"],
    );
  });

  it("reuses cached names across hook instances", async () => {
    vi.mocked(lookupDpnsName).mockResolvedValue("cached-name");
    const first = renderHook(() => useDpnsNames(sdk, ["cache-id"]));
    await waitFor(() =>
      expect(first.result.current).toEqual({ "cache-id": "cached-name" }),
    );
    first.unmount();

    const second = renderHook(() => useDpnsNames(sdk, ["cache-id"]));
    expect(second.result.current).toEqual({ "cache-id": "cached-name" });
    expect(lookupDpnsName).toHaveBeenCalledOnce();
  });

  it("leaves failed lookups uncached so a later mount retries them", async () => {
    vi.mocked(lookupDpnsName)
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce("retry-name");
    const first = renderHook(() => useDpnsNames(sdk, ["retry-id"]));
    await waitFor(() => expect(lookupDpnsName).toHaveBeenCalledOnce());
    first.unmount();

    const second = renderHook(() => useDpnsNames(sdk, ["retry-id"]));
    await waitFor(() =>
      expect(second.result.current).toEqual({ "retry-id": "retry-name" }),
    );
    expect(lookupDpnsName).toHaveBeenCalledTimes(2);
  });

  it("does not fetch without an SDK or usable identity IDs", () => {
    const withoutSdk = renderHook(() => useDpnsNames(null, ["no-sdk-id"]));
    expect(withoutSdk.result.current).toEqual({});
    withoutSdk.unmount();

    const withoutIds = renderHook(() =>
      useDpnsNames(sdk, [null, undefined, "  "]),
    );
    expect(withoutIds.result.current).toEqual({});
    expect(lookupDpnsName).not.toHaveBeenCalled();
  });

  it("does not cache a lookup that resolves after unmount", async () => {
    const pending = deferred<string | null>();
    vi.mocked(lookupDpnsName).mockReturnValueOnce(pending.promise);
    const first = renderHook(() => useDpnsNames(sdk, ["cancel-id"]));
    await waitFor(() => expect(lookupDpnsName).toHaveBeenCalledOnce());
    first.unmount();

    await act(async () => {
      pending.resolve("stale-name");
      await pending.promise;
    });

    vi.mocked(lookupDpnsName).mockResolvedValueOnce("fresh-name");
    const second = renderHook(() => useDpnsNames(sdk, ["cancel-id"]));
    await waitFor(() =>
      expect(second.result.current).toEqual({ "cancel-id": "fresh-name" }),
    );
    expect(lookupDpnsName).toHaveBeenCalledTimes(2);
  });
});
