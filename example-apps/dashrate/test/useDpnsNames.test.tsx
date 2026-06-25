// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReviewRecord } from "../src/dash/queries";
import type { DashSdk } from "../src/dash/types";
import type { Session } from "../src/session/types";

const resolveDpnsName = vi.fn();
vi.mock("../src/dash/resolveDpnsName", () => ({ resolveDpnsName }));

const { useDpnsNames } = await import("../src/hooks/useDpnsNames");

const readOnlySdk = { tag: "read-only" } as unknown as DashSdk;
const sessionSdk = { tag: "session" } as unknown as DashSdk;

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
  resolveDpnsName.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("useDpnsNames", () => {
  it("resolves names for reviewers and merges them into the map", async () => {
    resolveDpnsName.mockImplementation(async (_sdk, id) =>
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

  it("uses the read-only sdk when there is no session", async () => {
    resolveDpnsName.mockResolvedValue(null);
    const connectReadOnly = vi.fn().mockResolvedValue(readOnlySdk);
    renderHook(() =>
      useDpnsNames(
        makeArgs({ reviews: [review("a", "owner-1")], connectReadOnly }),
      ),
    );
    await waitFor(() => expect(resolveDpnsName).toHaveBeenCalled());
    expect(connectReadOnly).toHaveBeenCalled();
    expect(resolveDpnsName).toHaveBeenCalledWith(readOnlySdk, "owner-1");
  });

  it("uses the session sdk and includes the signed-in identity", async () => {
    resolveDpnsName.mockResolvedValue(null);
    const connectReadOnly = vi.fn();
    const session = { sdk: sessionSdk, identityId: "me" } as unknown as Session;
    renderHook(() => useDpnsNames(makeArgs({ session, connectReadOnly })));
    await waitFor(() => expect(resolveDpnsName).toHaveBeenCalled());
    expect(connectReadOnly).not.toHaveBeenCalled();
    expect(resolveDpnsName).toHaveBeenCalledWith(sessionSdk, "me");
  });

  it("does not re-resolve ids already in the cache", async () => {
    resolveDpnsName.mockResolvedValue("alice");
    const { result, rerender } = renderHook((props) => useDpnsNames(props), {
      initialProps: makeArgs({ reviews: [review("a", "owner-1")] }),
    });
    await waitFor(() => expect(result.current).toEqual({ "owner-1": "alice" }));
    resolveDpnsName.mockClear();

    // Re-render with the same owner already resolved → no new lookups.
    rerender(makeArgs({ reviews: [review("a", "owner-1")] }));
    await Promise.resolve();
    expect(resolveDpnsName).not.toHaveBeenCalled();
  });

  it("swallows resolution failures and keeps the prior map", async () => {
    resolveDpnsName.mockRejectedValue(new Error("dpns down"));
    const { result } = renderHook(() =>
      useDpnsNames(makeArgs({ reviews: [review("a", "owner-1")] })),
    );
    // Give the effect a tick to run and reject.
    await Promise.resolve();
    await Promise.resolve();
    expect(result.current).toEqual({});
  });
});
