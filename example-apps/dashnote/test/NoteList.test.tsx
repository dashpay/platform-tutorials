// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    createdAt: NOW - 60_000,
    updatedAt: NOW - 60_000,
    revision: 1,
    ...overrides,
  };
}

function renderList(notes: NoteRecord[]) {
  return render(
    <NoteList
      notes={notes}
      loading={false}
      selectedId={null}
      onSelect={vi.fn()}
      onNew={vi.fn()}
      canCreate
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("NoteList P6 row layout", () => {
  it("renders a single relative timestamp on the right (no second mono timestamp line)", () => {
    renderList([makeNote()]);

    expect(screen.getByText(/ago|just now/i)).toBeTruthy();
    // The old layout had a second timestamp line like "5/14/2026, 11:00 AM" —
    // a numeric date pattern with slashes. Guard against it returning.
    expect(screen.queryByText(/\d+\/\d+\/\d+/)).toBeNull();
  });

  it("italicizes the title when the note has no title (uses the fallback)", () => {
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

    // The title is the .truncate element inside each row button; matching by
    // text alone is ambiguous because the body preview repeats the fallback.
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

    // Listener must bail when the event originates in a text field, so the
    // default behavior (the "/" character reaching the input) is preserved.
    expect(event.defaultPrevented).toBe(false);
  });
});
