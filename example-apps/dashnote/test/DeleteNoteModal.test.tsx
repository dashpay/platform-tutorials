// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeleteNoteModal } from "../src/components/DeleteNoteModal";

afterEach(() => {
  cleanup();
});

describe("DeleteNoteModal", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <DeleteNoteModal
        open={false}
        noteTitle="something"
        deleting={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the note title in the body when present", () => {
    render(
      <DeleteNoteModal
        open
        noteTitle="Groceries"
        deleting={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText(/groceries/i)).toBeTruthy();
  });

  it("falls back to 'this note' when the title is blank", () => {
    render(
      <DeleteNoteModal
        open
        noteTitle="   "
        deleting={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText(/this note/i)).toBeTruthy();
  });

  it("fires onConfirm when Delete is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <DeleteNoteModal
        open
        noteTitle="Groceries"
        deleting={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("fires onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <DeleteNoteModal
        open
        noteTitle="Groceries"
        deleting={false}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while a delete is in flight", () => {
    render(
      <DeleteNoteModal
        open
        noteTitle="Groceries"
        deleting
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /deleting…/i }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: /^cancel$/i }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("does not fire onCancel when the disabled Cancel button is clicked mid-delete", () => {
    const onCancel = vi.fn();
    render(
      <DeleteNoteModal
        open
        noteTitle="Groceries"
        deleting
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("ignores Escape dismiss while deleting", () => {
    const onCancel = vi.fn();
    render(
      <DeleteNoteModal
        open
        noteTitle="Groceries"
        deleting
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );
    // The shared Modal listens for Escape on window and calls onClose;
    // DeleteNoteModal's onClose wrapper short-circuits while deleting.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("ignores backdrop dismiss while deleting", () => {
    const onCancel = vi.fn();
    render(
      <DeleteNoteModal
        open
        noteTitle="Groceries"
        deleting
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );
    // The shared Modal forwards backdrop clicks through onClose. The
    // wrapper guards onCancel when deleting=true so an accidental
    // dismiss mid-delete doesn't desync the parent's state.
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.parentElement!);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
