// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useLeaderboards } from "../src/hooks/useLeaderboards";
import { id, sdk } from "./helpers";

function ranked(...contracts: number[]) {
  return {
    entries: contracts.map((n, rank) => ({
      groupKeyHex: "",
      groupValue: id(n),
      value: 1n,
      valueAsNumber: 5 - rank,
      rank: BigInt(rank),
    })),
    valueScale: 1n,
  };
}

it("loads both rankings, the 4★+ set and names for the ranked rows", async () => {
  const client = sdk();
  vi.mocked(client.documents.ranked)
    .mockResolvedValueOnce(ranked(20, 21))
    .mockResolvedValueOnce(ranked(21, 22));
  vi.mocked(client.documents.having).mockResolvedValue(ranked(20));
  const { result } = renderHook(() => useLeaderboards(client, id(9)));
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(
    result.current.leaderboards?.topRated.map((row) => row.contractId),
  ).toEqual([id(20), id(21)]);
  expect(
    result.current.leaderboards?.mostRated.map((row) => row.contractId),
  ).toEqual([id(21), id(22)]);
  expect([...result.current.leaderboards!.highlyRated]).toEqual([id(20)]);
  // One batched endorsement lookup covers every ranked contract.
  expect(client.documents.query).toHaveBeenCalledWith(
    expect.objectContaining({
      documentTypeName: "appEndorsement",
      where: [["contractId", "in", [id(20), id(21), id(22)]]],
    }),
  );
  // One batched average gives every ranked row its review count.
  expect(client.documents.average).toHaveBeenCalledWith(
    expect.objectContaining({
      where: [["contractId", "in", [id(20), id(21), id(22)]]],
      groupBy: ["contractId"],
    }),
    "stars",
  );
  expect([...result.current.leaderboards!.averages.keys()]).toEqual([
    id(20),
    id(21),
    id(22),
  ]);
});

it("keeps a failure local and reloads on a refresh token bump", async () => {
  const client = sdk();
  vi.mocked(client.documents.ranked).mockRejectedValueOnce(
    new Error("ranked query refused"),
  );
  const { result, rerender } = renderHook(
    ({ token }) => useLeaderboards(client, id(9), token),
    { initialProps: { token: 0 } },
  );
  await waitFor(() =>
    expect(result.current.error).toBe("ranked query refused"),
  );
  expect(result.current.leaderboards).toBeNull();
  rerender({ token: 1 });
  await waitFor(() => expect(result.current.leaderboards).not.toBeNull());
  expect(result.current.error).toBe("");
});
