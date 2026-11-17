// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Leaderboard } from "../src/components/Leaderboard";

type Props = Parameters<typeof Leaderboard>[0];

afterEach(() => {
  cleanup();
});

function renderBoard(overrides: Partial<Props> = {}) {
  const props: Props = {
    topRated: [
      { resourceId: "dashproof-lab", value: 5 },
      // A truncated fixed-point avg (11/3) — shown rounded.
      { resourceId: "dashnote", value: 3.666666666666667 },
    ],
    mostReviewed: [
      { resourceId: "dashnote", value: 3 },
      { resourceId: "tokens", value: 1 },
    ],
    loading: false,
    error: "",
    selectedResourceId: "dashnote",
    onSelectResource: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<Leaderboard {...props} />) };
}

function rowTexts(container: HTMLElement) {
  return [...container.querySelectorAll(".leaderboard-row")].map(
    (row) => row.textContent,
  );
}

describe("Leaderboard", () => {
  it("shows Top rated by default with rounded averages", () => {
    const { container } = renderBoard();
    expect(
      screen
        .getByRole("button", { name: "Top rated" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(rowTexts(container)).toEqual([
      "1DashProof Lab5.0 ★",
      "2Dashnote3.7 ★",
    ]);
    expect(
      container.querySelector(".leaderboard-row.selected")?.textContent,
    ).toContain("Dashnote");
  });

  it("switches to Most reviewed", () => {
    const { container } = renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Most reviewed" }));
    expect(rowTexts(container)).toEqual([
      "1Dashnote3 reviews",
      "2Tokens1 review",
    ]);
  });

  it("selects a resource from a row", () => {
    const onSelectResource = vi.fn();
    renderBoard({ onSelectResource });
    fireEvent.click(screen.getByRole("button", { name: /DashProof Lab/ }));
    expect(onSelectResource).toHaveBeenCalledWith("dashproof-lab");
  });

  it("renders loading, empty and error states", () => {
    const { rerender } = renderBoard({ topRated: [], loading: true });
    expect(screen.getByRole("status").textContent).toContain("Loading");

    rerender(
      <Leaderboard
        topRated={[]}
        mostReviewed={[]}
        loading={false}
        error=""
        selectedResourceId="intro"
        onSelectResource={() => {}}
      />,
    );
    expect(screen.getByText("No ratings yet.")).toBeTruthy();

    rerender(
      <Leaderboard
        topRated={[]}
        mostReviewed={[]}
        loading={false}
        error="no ranked index covers group_by"
        selectedResourceId="intro"
        onSelectResource={() => {}}
      />,
    );
    expect(screen.getByText("Leaderboard unavailable.")).toBeTruthy();
  });
});
