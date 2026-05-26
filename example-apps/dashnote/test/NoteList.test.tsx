// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteList } from "../src/components/NoteList";
import type { NoteRecord } from "../src/dash/queries";

const NOW = Date.now();

function makeNote(overrides: Partial<NoteRecord> = {}): NoteRecord {
  return {
    id: "note-a",
    ownerId: "identity-1",
    title: "Meeting agenda",
    message: "Draft notes for the kickoff meeting.",
    createdAt: NOW - 120_000,
    updatedAt: NOW - 60_000,
    revision: 1,
    ...overrides,
  };
}

function renderList(
  notes: NoteRecord[],
  overrides: Partial<React.ComponentProps<typeof NoteList>> = {},
) {
  const props: React.ComponentProps<typeof NoteList> = {
    notes,
    loading: false,
    selectedId: null,
    onSelect: vi.fn(),
    onNew: vi.fn(),
    canCreate: true,
    isDesktop: true,
    ...overrides,
  };
  return { props, ...render(<NoteList {...props} />) };
}

afterEach(() => {
  cleanup();
});

describe("NoteList desktop behavior", () => {
  it("keeps the desktop header, count, create button, and shortcut hint", () => {
    renderList([makeNote()]);

    expect(screen.getByText(/my notes/i)).toBeTruthy();
    expect(screen.getByText(/1 note/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /new note/i })).toBeTruthy();
    expect(screen.getByText("/")).toBeTruthy();
  });

  it("renders a single relative timestamp on the right", () => {
    renderList([makeNote()]);

    expect(screen.getByText(/ago|just now/i)).toBeTruthy();
    expect(screen.queryByText(/\d+\/\d+\/\d+/)).toBeNull();
  });

  it("italicizes the title when the note has no title", () => {
    renderList([
      makeNote({
        id: "no-title",
        title: null,
        message: "Body of an untitled note",
      }),
      makeNote({
        id: "titled",
        title: "Meeting agenda",
        message: "Body of a titled note",
      }),
    ]);

    const fallbackTitle = screen
      .getAllByText("Body of an untitled note")
      .find((el) => el.className.includes("truncate"));
    expect(fallbackTitle?.className).toMatch(/italic/);

    const titled = screen.getByText("Meeting agenda");
    expect(titled.className).not.toMatch(/italic/);
  });

  it("focuses the search input when '/' is pressed outside a text field", () => {
    renderList([makeNote()]);

    const search = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
    expect(document.activeElement).not.toBe(search);

    fireEvent.keyDown(window, { key: "/" });

    expect(document.activeElement).toBe(search);
  });

  it("does not steal '/' keystrokes typed inside the search input itself", () => {
    renderList([makeNote()]);

    const search = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
    search.focus();
    const event = new KeyboardEvent("keydown", {
      key: "/",
      bubbles: true,
      cancelable: true,
    });
    search.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});

describe("NoteList mobile refresh", () => {
  it("uses a compact mobile header with no count row or shortcut hint", () => {
    const { container } = renderList([makeNote()], { isDesktop: false });

    expect(screen.queryByRole("heading", { name: /^notes$/i })).toBeNull();
    expect(screen.queryByText(/my notes/i)).toBeNull();
    expect(screen.queryByText(/1 note/i)).toBeNull();
    expect(screen.queryByText("/")).toBeNull();
    expect(screen.getByPlaceholderText(/search/i)).toBeTruthy();
    expect(container.querySelector("section")?.className).not.toMatch(
      /max-md:border-t/,
    );
  });

  it("pins the mobile search row above the scrolling list", () => {
    renderList([makeNote()], { isDesktop: false });

    const searchRow = screen.getByPlaceholderText(/search/i).closest("div");

    expect(searchRow?.className).toMatch(/max-md:sticky/);
    expect(searchRow?.className).toMatch(/max-md:top-\[53px\]/);
    expect(searchRow?.className).toMatch(/max-md:z-20/);
    expect(searchRow?.className).toMatch(/max-md:py-2/);
    expect(searchRow?.className).toMatch(/max-md:bg-surface\/95/);
    expect(searchRow?.className).toMatch(/max-md:backdrop-blur/);
    expect(searchRow?.className).not.toMatch(/max-md:pt-4/);
  });

  it("opens a note when the mobile row is tapped", () => {
    const onSelect = vi.fn();
    renderList([makeNote()], { isDesktop: false, onSelect });

    fireEvent.click(
      screen.getByRole("button", { name: /open meeting agenda/i }),
    );

    expect(onSelect).toHaveBeenCalledWith("note-a");
  });

  it("opens the row action sheet from the ellipsis without selecting the note", () => {
    const onSelect = vi.fn();
    renderList([makeNote()], { isDesktop: false, onSelect });

    fireEvent.click(
      screen.getByRole("button", { name: /actions for meeting agenda/i }),
    );

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: /note actions/i })).toBeTruthy();
  });

  it("shows Open, Info, and Delete for authenticated mobile row actions", () => {
    renderList([makeNote()], {
      isDesktop: false,
      canDeleteNotes: true,
      onDeleteNote: vi.fn(),
    });

    fireEvent.click(
      screen.getByRole("button", { name: /actions for meeting agenda/i }),
    );
    const sheet = screen.getByRole("dialog", { name: /note actions/i });

    expect(within(sheet).getByRole("button", { name: /^open$/i })).toBeTruthy();
    expect(within(sheet).getByRole("button", { name: /^info$/i })).toBeTruthy();
    expect(
      within(sheet).getByRole("button", { name: /^delete$/i }),
    ).toBeTruthy();
  });

  it("shows Open, Info, and Sign in for read-only mobile row actions", () => {
    renderList([makeNote()], {
      isDesktop: false,
      canDeleteNotes: false,
      isReadOnly: true,
    });

    fireEvent.click(
      screen.getByRole("button", { name: /actions for meeting agenda/i }),
    );
    const sheet = screen.getByRole("dialog", { name: /note actions/i });

    expect(within(sheet).getByRole("button", { name: /^open$/i })).toBeTruthy();
    expect(within(sheet).getByRole("button", { name: /^info$/i })).toBeTruthy();
    expect(
      within(sheet).getByRole("button", { name: /sign in to edit/i }),
    ).toBeTruthy();
  });

  it("delete row action requests confirmation flow but does not select the note", () => {
    const onSelect = vi.fn();
    const onDeleteNote = vi.fn();
    const note = makeNote();
    renderList([note], {
      isDesktop: false,
      onSelect,
      canDeleteNotes: true,
      onDeleteNote,
    });

    fireEvent.click(
      screen.getByRole("button", { name: /actions for meeting agenda/i }),
    );
    const sheet = screen.getByRole("dialog", { name: /note actions/i });
    fireEvent.click(within(sheet).getByRole("button", { name: /^delete$/i }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onDeleteNote).toHaveBeenCalledWith(note);
  });

  it("keeps hidden swipe actions out of tab order and the accessibility tree", () => {
    renderList([makeNote()], { isDesktop: false });

    const row = screen.getByTestId("note-row-note-a");
    const actionRail = row.querySelector("[aria-hidden]");
    const more = within(row).getByText("More").closest("button");
    const signIn = within(row).getByText("Sign in").closest("button");

    expect(actionRail?.getAttribute("aria-hidden")).toBe("true");
    expect(more?.getAttribute("tabindex")).toBe("-1");
    expect(signIn?.getAttribute("tabindex")).toBe("-1");
    expect(screen.queryByRole("button", { name: /^more$/i })).toBeNull();
  });

  it("swipe-left reveals mobile row actions after the horizontal threshold", () => {
    renderList([makeNote()], { isDesktop: false });

    const row = screen.getByTestId("note-row-note-a");
    const foreground = screen.getByTestId("note-row-foreground-note-a");
    fireEvent.mouseDown(row, { button: 0, clientX: 220, clientY: 20 });
    fireEvent.mouseMove(row, { clientX: 140, clientY: 22 });
    fireEvent.mouseUp(row);

    expect(foreground.getAttribute("style")).toContain("translateX(-156px)");
    expect(
      row.querySelector("[aria-hidden]")?.getAttribute("aria-hidden"),
    ).toBe("false");
    expect(screen.getByRole("button", { name: /^more$/i })).toBeTruthy();
  });

  it("vertical movement cancels mobile row swipe reveal", () => {
    renderList([makeNote()], { isDesktop: false });

    const row = screen.getByTestId("note-row-note-a");
    const foreground = screen.getByTestId("note-row-foreground-note-a");
    fireEvent.mouseDown(row, { button: 0, clientX: 220, clientY: 20 });
    fireEvent.mouseMove(row, { clientX: 216, clientY: 60 });
    fireEvent.mouseUp(row);

    expect(foreground.getAttribute("style")).toContain("translateX(0px)");
  });

  it("ignores edge-start mobile swipe gestures", () => {
    renderList([makeNote()], { isDesktop: false });

    const row = screen.getByTestId("note-row-note-a");
    const foreground = screen.getByTestId("note-row-foreground-note-a");
    fireEvent.mouseDown(row, { button: 0, clientX: 12, clientY: 20 });
    fireEvent.mouseMove(row, { clientX: 0, clientY: 20 });
    fireEvent.mouseUp(row);

    expect(foreground.getAttribute("style")).toContain("translateX(0px)");
  });

  it("opening one swiped row closes the previous row", () => {
    renderList(
      [
        makeNote({ id: "note-a", title: "First" }),
        makeNote({ id: "note-b", title: "Second" }),
      ],
      { isDesktop: false },
    );

    const first = screen.getByTestId("note-row-note-a");
    const firstForeground = screen.getByTestId("note-row-foreground-note-a");
    const second = screen.getByTestId("note-row-note-b");
    const secondForeground = screen.getByTestId("note-row-foreground-note-b");

    fireEvent.mouseDown(first, { button: 0, clientX: 220, clientY: 20 });
    fireEvent.mouseMove(first, { clientX: 140, clientY: 22 });
    fireEvent.mouseUp(first);
    expect(firstForeground.getAttribute("style")).toContain(
      "translateX(-156px)",
    );

    fireEvent.mouseDown(second, { button: 0, clientX: 220, clientY: 20 });
    fireEvent.mouseMove(second, { clientX: 140, clientY: 22 });
    fireEvent.mouseUp(second);

    expect(firstForeground.getAttribute("style")).toContain("translateX(0px)");
    expect(secondForeground.getAttribute("style")).toContain(
      "translateX(-156px)",
    );
  });
});
