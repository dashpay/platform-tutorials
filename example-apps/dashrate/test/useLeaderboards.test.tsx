// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RESOURCES } from "../src/catalog/resources";
import type { DashSdk } from "../src/dash/types";

const getLeaderboard = vi.fn();
const getResourcesWithMinAverage = vi.fn();
vi.mock("../src/dash/leaderboard", () => ({
  getLeaderboard,
  getResourcesWithMinAverage,
}));

const { useLeaderboards } = await import("../src/hooks/useLeaderboards");

const fakeSdk = { tag: "fake" } as unknown as DashSdk;

function makeArgs(
  overrides: Partial<Parameters<typeof useLeaderboards>[0]> = {},
) {
  return {
    contractId: "c1",
    refreshToken: 0,
    connectReadOnly: vi.fn().mockResolvedValue(fakeSdk),
    log: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  getLeaderboard.mockImplementation(async ({ metric }: { metric: string }) =>
    metric === "avg"
      ? [{ resourceId: "dashproof-lab", value: 5 }]
      : [{ resourceId: "dashnote", value: 3 }],
  );
  getResourcesWithMinAverage.mockResolvedValue([
    { resourceId: "dashproof-lab", value: 5 },
    { resourceId: "dashmint-lab", value: 4 },
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe("useLeaderboards", () => {
  it("loads both rankings and the 4★+ set, scoped to the catalog", async () => {
    const args = makeArgs();
    const { result } = renderHook(() => useLeaderboards(args));

    await waitFor(() => expect(result.current.leaderboards).not.toBeNull());
    expect(result.current.leaderboards).toEqual({
      topRated: [{ resourceId: "dashproof-lab", value: 5 }],
      mostReviewed: [{ resourceId: "dashnote", value: 3 }],
      highlyRated: ["dashproof-lab", "dashmint-lab"],
    });
    expect(result.current.leaderboardsLoading).toBe(false);
    const ids = RESOURCES.map((resource) => resource.id);
    expect(getLeaderboard).toHaveBeenCalledWith(
      expect.objectContaining({
        sdk: fakeSdk,
        metric: "avg",
        resourceIds: ids,
      }),
    );
    expect(getResourcesWithMinAverage).toHaveBeenCalledWith(
      expect.objectContaining({ minAverage: 4, resourceIds: ids }),
    );
  });

  it("runs no queries without a contract", async () => {
    const args = makeArgs({ contractId: "" });
    const { result } = renderHook(() => useLeaderboards(args));
    await waitFor(() => expect(result.current.leaderboardsLoading).toBe(false));
    expect(result.current.leaderboards).toBeNull();
    expect(getLeaderboard).not.toHaveBeenCalled();
  });

  it("keeps a failure local", async () => {
    getLeaderboard.mockRejectedValue(new Error("no ranked index covers"));
    const args = makeArgs();
    const { result } = renderHook(() => useLeaderboards(args));

    await waitFor(() =>
      expect(result.current.leaderboardsError).toBe("no ranked index covers"),
    );
    expect(result.current.leaderboards).toBeNull();
    expect(args.log).toHaveBeenCalledWith(
      "Leaderboards failed: no ranked index covers",
    );
  });

  it("reloads when the refresh token is bumped", async () => {
    // Stable args, as App passes (connectReadOnly/log are memoized there).
    const args = makeArgs();
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useLeaderboards>[0]) => useLeaderboards(props),
      { initialProps: args },
    );
    await waitFor(() => expect(result.current.leaderboards).not.toBeNull());
    expect(getLeaderboard).toHaveBeenCalledTimes(2);

    getResourcesWithMinAverage.mockResolvedValue([]);
    rerender({ ...args, refreshToken: 1 });

    await waitFor(() =>
      expect(result.current.leaderboards?.highlyRated).toEqual([]),
    );
    expect(getLeaderboard).toHaveBeenCalledTimes(4);
    // Always the shared read-only client — leaderboards don't need a session.
    expect(args.connectReadOnly).toHaveBeenCalledTimes(2);
  });
});
