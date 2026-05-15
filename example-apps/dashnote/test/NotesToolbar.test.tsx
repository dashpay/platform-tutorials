// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotesToolbar } from "../src/components/NotesToolbar";

afterEach(() => {
  cleanup();
});

describe("NotesToolbar", () => {
  it("renders the title and testnet badge", () => {
    render(<NotesToolbar title="Notes Workspace" />);
    expect(
      screen.getByRole("heading", { name: "Notes Workspace" }),
    ).toBeTruthy();
    expect(screen.getByText("testnet")).toBeTruthy();
  });

  it("omits the Activity button when onOpenActivity is undefined", () => {
    render(<NotesToolbar title="Notes" />);
    expect(screen.queryByRole("button", { name: /activity/i })).toBeNull();
  });

  it("renders the Activity button with a cross-platform shortcut hint", () => {
    const onOpenActivity = vi.fn();
    render(<NotesToolbar title="Notes" onOpenActivity={onOpenActivity} />);

    const button = screen.getByRole("button", { name: /activity/i });
    expect(button.textContent).toMatch(/⌘\/Ctrl\s*L/);
    fireEvent.click(button);
    expect(onOpenActivity).toHaveBeenCalledTimes(1);
  });

  it("renders the rightSlot content", () => {
    render(
      <NotesToolbar
        title="Notes"
        rightSlot={<button type="button">Right action</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Right action" })).toBeTruthy();
  });
});
