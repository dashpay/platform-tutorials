// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Leaderboard } from "../src/components/Leaderboard";
import type { Leaderboards } from "../src/hooks/useLeaderboards";
import type { RegistryEntry } from "../src/dash/registryReads";
import { id } from "./helpers";

afterEach(cleanup);

function entry(n: number, name: string): RegistryEntry {
  return {
    id: id(200 + n),
    ownerId: id(1),
    contractId: id(n),
    name,
    tagline: "Tagline",
    category: "other",
    tags: [],
    revision: 1n,
  };
}

const boards: Leaderboards = {
  topRated: [
    { contractId: id(20), value: 4.5, rank: 0 },
    { contractId: id(21), value: 4.5, rank: 1 },
    { contractId: id(22), value: 3, rank: 2 },
  ],
  mostRated: [
    { contractId: id(22), value: 9, rank: 0 },
    { contractId: id(20), value: 2, rank: 1 },
  ],
  highlyRated: new Set([id(20), id(21)]),
  names: new Map([
    [id(20), { name: "Alpha", official: true, entry: entry(20, "Alpha") }],
    [id(21), { name: "Beta", official: false, entry: entry(21, "Beta") }],
  ]),
  averages: new Map([
    [id(20), { count: 2n, sum: 9n, average: 4.5 }],
    [id(21), { count: 4n, sum: 18n, average: 4.5 }],
    [id(22), { count: 9n, sum: 27n, average: 3 }],
  ]),
};

it("shows each average with its review count and labels community names", () => {
  const open = vi.fn();
  render(
    <Leaderboard leaderboards={boards} loading={false} error="" open={open} />,
  );
  const rows = screen.getAllByRole("listitem").map((row) => row.textContent);
  // Equal averages share a rank; their order means nothing.
  expect(rows[0]).toMatch(/^1Alpha★ 4\.52 reviews$/);
  expect(rows[1]).toMatch(/^1BetaCommunity name★ 4\.54 reviews$/);
  expect(rows[2]).toMatch(/^3.*★ 3\.09 reviews$/);
  expect(screen.getByText(/Anyone can write it/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));
  expect(open).toHaveBeenCalledWith(
    id(20),
    "Alpha",
    boards.names.get(id(20))!.entry,
  );
});

it("switches to Most rated and reports loading and errors", () => {
  const { rerender } = render(
    <Leaderboard
      leaderboards={boards}
      loading={false}
      error=""
      open={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Most rated" }));
  expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual(
    [expect.stringContaining("9 reviews"), expect.stringContaining("Alpha")],
  );
  rerender(<Leaderboard leaderboards={null} loading error="" open={vi.fn()} />);
  expect(screen.getByRole("status").textContent).toBe("Loading…");
  rerender(
    <Leaderboard
      leaderboards={null}
      loading={false}
      error="boom"
      open={vi.fn()}
    />,
  );
  expect(screen.getByText("Leaderboard unavailable.")).toBeTruthy();
});
