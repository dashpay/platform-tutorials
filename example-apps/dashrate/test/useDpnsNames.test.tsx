// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReviewRecord } from "../src/dash/queries";
import type { DashSdk } from "../src/dash/types";
import type { Session } from "../src/session/types";

import { useDpnsNames } from "../src/hooks/useDpnsNames";

// The hook calls sdk.dpns.username directly (so a thrown lookup failure stays
// distinct from a confirmed null miss). Mock the SDK method, not a helper.
const username = vi.fn();
const readOnlySdk = {
  tag: "read-only",
  dpns: { username },
} as unknown as DashSdk;
const sessionSdk = {
  tag: "session",
  dpns: { username },
} as unknown as DashSdk;

function review(id: string, ownerId: string): ReviewRecord {
  return {
    id,
    ownerId,
    resourceId: "tokens",
    rating: 4,
    reviewText: "",
    createdAt: 1,
    updatedAt: 2,
    revision: 1,
  };
}

function makeArgs(overrides: Partial<Parameters<typeof useDpnsNames>[0]> = {}) {
  return {
    reviews: [] as ReviewRecord[],
    myReviews: [] as ReviewRecord[],
    session: null as Session | null,
    connectReadOnly: vi.fn().mockResolvedValue(readOnlySdk),
    ...overrides,
  };
}

beforeEach(() => {
  username.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("useDpnsNames", () => {
  it("resolves names for reviewers and merges them into the map", async () => {
    username.mockImplementation(async (id: string) =>
      id === "owner-1" ? "alice" : null,
    );
    const { result } = renderHook(() =>
      useDpnsNames(
        makeArgs({ reviews: [review("a", "owner-1"), review("b", "owner-2")] }),
      ),
    );
    await waitFor(() => {
      expect(result.current).toEqual({ "owner-1": "alice", "owner-2": null });
    });
  });

  it("strips the .dash TLD and treats empty/non-string as a miss", async () => {
    username.mockImplementation(async (id: string) => {
      if (id === "owner-1") return "alice.dash";
      if (id === "owner-2") return "";
      return undefined;
    });
    const { result } = renderHook(() =>
      useDpnsNames(
        makeArgs({
          reviews: [
            review("a", "owner-1"),
            review("b", "owner-2"),
            review("c", "owner-3"),
          ],
        }),
      ),
    );
    await waitFor(() => {
      expect(result.current).toEqual({
        "owner-1": "alice",
        "owner-2": null,
        "owner-3": null,
      });
    });
  });

  it("uses the read-only sdk when there is no session", async () => {
    username.mockResolvedValue(null);
    const connectReadOnly = vi.fn().mockResolvedValue(readOnlySdk);
    renderHook(() =>
      useDpnsNames(
        makeArgs({ reviews: [review("a", "owner-1")], connectReadOnly }),
      ),
    );
    await waitFor(() => expect(username).toHaveBeenCalled());
    expect(connectReadOnly).toHaveBeenCalled();
    expect(username).toHaveBeenCalledWith("owner-1");
  });

  it("uses the session sdk and includes the signed-in identity", async () => {
    username.mockResolvedValue(null);
    const connectReadOnly = vi.fn();
    const session = { sdk: sessionSdk, identityId: "me" } as unknown as Session;
    renderHook(() => useDpnsNames(makeArgs({ session, connectReadOnly })));
    await waitFor(() => expect(username).toHaveBeenCalled());
    expect(connectReadOnly).not.toHaveBeenCalled();
    expect(username).toHaveBeenCalledWith("me");
  });

  it("does not re-resolve ids already in the cache", async () => {
    username.mockResolvedValue("alice");
    const { result, rerender } = renderHook((props) => useDpnsNames(props), {
      initialProps: makeArgs({ reviews: [review("a", "owner-1")] }),
    });
    await waitFor(() => expect(result.current).toEqual({ "owner-1": "alice" }));
    username.mockClear();

    // Re-render with the same owner already resolved → no new lookups.
    rerender(makeArgs({ reviews: [review("a", "owner-1")] }));
    await Promise.resolve();
    expect(username).not.toHaveBeenCalled();
  });

  it("swallows resolution failures and keeps the prior map", async () => {
    username.mockRejectedValue(new Error("dpns down"));
    const { result } = renderHook(() =>
      useDpnsNames(makeArgs({ reviews: [review("a", "owner-1")] })),
    );
    // Give the effect a tick to run and reject.
    await Promise.resolve();
    await Promise.resolve();
    expect(result.current).toEqual({});
  });

  it("does not cache a failure, so the id is retried on a later run", async () => {
    // First run fails; the id must NOT be cached (as null), otherwise a single
    // network blip would permanently degrade the name to a short id.
    username.mockRejectedValueOnce(new Error("dpns down"));
    const { result, rerender } = renderHook((props) => useDpnsNames(props), {
      initialProps: makeArgs({ reviews: [review("a", "owner-1")] }),
    });
    await waitFor(() => expect(username).toHaveBeenCalledTimes(1));
    expect(result.current).toEqual({});

    // A later effect run retries the still-pending id and succeeds.
    username.mockResolvedValue("alice");
    rerender(makeArgs({ reviews: [review("a", "owner-1")] }));
    await waitFor(() => expect(result.current).toEqual({ "owner-1": "alice" }));
  });

  it("caches a confirmed miss (null) and does not retry it", async () => {
    username.mockResolvedValue(null);
    const { result, rerender } = renderHook((props) => useDpnsNames(props), {
      initialProps: makeArgs({ reviews: [review("a", "owner-1")] }),
    });
    await waitFor(() => expect(result.current).toEqual({ "owner-1": null }));
    username.mockClear();

    rerender(makeArgs({ reviews: [review("a", "owner-1")] }));
    await Promise.resolve();
    expect(username).not.toHaveBeenCalled();
  });
});
