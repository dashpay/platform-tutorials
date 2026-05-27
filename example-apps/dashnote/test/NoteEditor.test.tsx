// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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
    createdAt: NOW - 120_000,
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
    messageBytes: 27,
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

describe("NoteEditor mobile refresh", () => {
  it("shows mobile Back with no Save for a clean existing note", () => {
    renderEditor({ isDesktop: false, canEdit: true, dirty: false });

    expect(screen.getByRole("button", { name: /back to notes/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^save$/i })).toBeNull();
    expect(screen.getByText(/updated/i)).toBeTruthy();
  });

  it("shows and enables mobile Save only when dirty", () => {
    const onSave = vi.fn();
    renderEditor({
      isDesktop: false,
      canEdit: true,
      dirty: true,
      onSave,
    });

    const save = screen.getByRole("button", { name: /^save$/i });
    expect((save as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/^edited$/i)).toBeTruthy();
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("shows Saving and disables mobile Save while saving", () => {
    renderEditor({
      isDesktop: false,
      canEdit: true,
      dirty: true,
      saving: true,
    });

    const save = screen.getByRole("button", { name: /saving/i });
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables mobile Save when the body is oversize", () => {
    renderEditor({
      isDesktop: false,
      canEdit: true,
      dirty: true,
      messageOversize: true,
    });

    const save = screen.getByRole("button", { name: /^save$/i });
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the mobile body borderless when focused", () => {
    renderEditor({ isDesktop: false, canEdit: true, dirty: true });

    const body = screen.getByLabelText(/body/i) as HTMLTextAreaElement;
    body.focus();

    expect(body.className).toMatch(/\bmobile-note-editor-field\b/);
    expect(body.className).toMatch(/\bborder-0\b/);
    expect(body.className).toMatch(/\boutline-none\b/);
    expect(body.className).not.toMatch(/\bring\b/);
  });

  it("renders the mobile public-chain notice", () => {
    renderEditor({ isDesktop: false, canEdit: true });

    expect(
      screen.getByText(/notes are stored publicly on dash platform/i),
    ).toBeTruthy();
  });

  it("keeps desktop metadata footer behavior", () => {
    renderEditor({ isDesktop: true, canEdit: true });

    expect(screen.getByText("$createdAt")).toBeTruthy();
    expect(screen.getByText("$updatedAt")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^save$/i })).toBeTruthy();
  });

  it("moves mobile delete into the note actions sheet", () => {
    const onDelete = vi.fn();
    renderEditor({
      isDesktop: false,
      canEdit: true,
      canDelete: true,
      onDelete,
    });

    expect(screen.queryByRole("button", { name: /delete note/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /note actions/i }));
    const sheet = screen.getByRole("dialog", { name: /note actions/i });
    fireEvent.click(within(sheet).getByRole("button", { name: /^delete$/i }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("hides mobile Delete when canDelete is false", () => {
    renderEditor({ isDesktop: false, canDelete: false });

    fireEvent.click(screen.getByRole("button", { name: /note actions/i }));
    const sheet = screen.getByRole("dialog", { name: /note actions/i });

    expect(
      within(sheet).queryByRole("button", { name: /^delete$/i }),
    ).toBeNull();
  });

  it("shows mobile note metadata from the Info action", () => {
    renderEditor({ isDesktop: false, note: makeNote({ revision: 4 }) });

    fireEvent.click(screen.getByRole("button", { name: /note actions/i }));
    fireEvent.click(screen.getByRole("button", { name: /^info$/i }));

    const dialog = screen.getByRole("dialog", { name: /note info/i });
    expect(within(dialog).getByText(/revision/i)).toBeTruthy();
    expect(within(dialog).getByText("4")).toBeTruthy();
    expect(within(dialog).getByText(/created/i)).toBeTruthy();
    expect(within(dialog).getByText(/updated/i)).toBeTruthy();
    expect(within(dialog).getByText(/5,120 B/i)).toBeTruthy();
  });

  it("uses a visible mobile read-only Sign in CTA instead of an invisible overlay", () => {
    const onOpenLogin = vi.fn();
    renderEditor({
      isDesktop: false,
      isReadOnly: true,
      onOpenLogin,
    });

    const cta = screen.getByRole("button", { name: /^sign in to edit$/i });
    expect(cta.className).not.toMatch(/\babsolute\b/);
    expect(cta.className).not.toMatch(/\binset-0\b/);

    fireEvent.click(cta);
    expect(onOpenLogin).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: /sign in to edit this note/i }),
    ).toBeNull();
  });
});
