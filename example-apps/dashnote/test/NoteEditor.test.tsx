// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteEditor } from "../src/components/NoteEditor";
import type { NoteRecord } from "../src/dash/queries";

const NOW = Date.now();

function makeNote(overrides: Partial<NoteRecord> = {}): NoteRecord {
  return {
    id: "note-a",
    ownerId: "identity-1",
    title: "Meeting agenda",
    message: "Read this in browsing mode.",
    createdAt: NOW - 60_000,
    updatedAt: NOW - 60_000,
    revision: 1,
    ...overrides,
  };
}

type EditorOverrides = Partial<React.ComponentProps<typeof NoteEditor>>;

function renderEditor(overrides: EditorOverrides = {}) {
  const props: React.ComponentProps<typeof NoteEditor> = {
    selectedId: "note-a",
    note: makeNote(),
    title: "Meeting agenda",
    message: "Read this in browsing mode.",
    onTitleChange: vi.fn(),
    onMessageChange: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onBack: vi.fn(),
    loading: false,
    saving: false,
    deleting: false,
    canEdit: false,
    canDelete: false,
    dirty: false,
    messageBytes: 0,
    messageOversize: false,
    contractReady: true,
    contractId: "contract-1",
    error: null,
    conflictWarning: null,
    onOpenLogin: vi.fn(),
    onOpenSettings: vi.fn(),
    isReadOnly: false,
    isDesktop: true,
    ...overrides,
  };
  return { props, ...render(<NoteEditor {...props} />) };
}

afterEach(() => {
  cleanup();
});

describe("NoteEditor read-only sign-in surface", () => {
  it("renders a click-to-sign-in overlay over the editor body when read-only", () => {
    const onOpenLogin = vi.fn();
    renderEditor({ isReadOnly: true, onOpenLogin });

    const overlay = screen.getByRole("button", {
      name: /sign in to edit this note/i,
    });
    fireEvent.click(overlay);
    expect(onOpenLogin).toHaveBeenCalledTimes(1);
  });

  it("does not render the click-to-sign-in overlay in edit mode", () => {
    renderEditor({ isReadOnly: false, canEdit: true });

    expect(
      screen.queryByRole("button", { name: /sign in to edit this note/i }),
    ).toBeNull();
  });

  it("no longer renders the old 'Sign in to edit' toolbar button when read-only", () => {
    renderEditor({ isReadOnly: true });

    // The old button name was "Sign in to edit"; the overlay's aria-label is
    // "Sign in to edit this note". Anchor the regex to avoid a substring match.
    expect(
      screen.queryByRole("button", { name: /^sign in to edit$/i }),
    ).toBeNull();
  });

  it("does not render the Save button when read-only", () => {
    renderEditor({ isReadOnly: true });

    expect(screen.queryByRole("button", { name: /^save$/i })).toBeNull();
  });

  it("positions the read-only overlay above the inputs (last sibling, absolute, z-10)", () => {
    renderEditor({ isReadOnly: true });

    const overlay = screen.getByRole("button", {
      name: /sign in to edit this note/i,
    });

    // Paint order: in a position:relative parent with two stacking-context
    // peers at the same z-index, the later sibling wins. The overlay must be
    // the last child of the label so clicks on the input region hit it.
    const parent = overlay.parentElement;
    expect(parent).not.toBeNull();
    expect(parent?.lastElementChild).toBe(overlay);

    // jsdom doesn't run layout, so we can't simulate hit-testing — verify the
    // classes that drive stacking instead. Regressing any of these (z-index,
    // absolute positioning, or inset) would break click capture in a browser.
    expect(overlay.className).toMatch(/\babsolute\b/);
    expect(overlay.className).toMatch(/\binset-0\b/);
    expect(overlay.className).toMatch(/\bz-10\b/);

    // And the disabled-input fallback: even if the overlay regresses, the
    // underlying fields stay non-editable so clicks can't mutate state.
    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    const bodyInput = screen.getByLabelText(/body/i) as HTMLTextAreaElement;
    expect(titleInput.disabled).toBe(true);
    expect(bodyInput.disabled).toBe(true);
  });
});
