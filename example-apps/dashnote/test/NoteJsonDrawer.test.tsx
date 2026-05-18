// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteJsonDrawer } from "../src/components/NoteJsonDrawer";
import type { NoteRecord } from "../src/dash/queries";

const note: NoteRecord = {
  id: "note-abc",
  ownerId: "owner-1",
  title: "Groceries",
  message: "milk, eggs",
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_005_000,
  revision: 2,
};

afterEach(() => {
  cleanup();
});

describe("NoteJsonDrawer", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <NoteJsonDrawer
        open={false}
        note={note}
        contractId="contract-1"
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when note is null", () => {
    const { container } = render(
      <NoteJsonDrawer
        open
        note={null}
        contractId="contract-1"
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the document payload as pretty JSON with revision badge", () => {
    render(
      <NoteJsonDrawer
        open
        note={note}
        contractId="contract-1"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/rev 2/)).toBeTruthy();
    const pre = screen.getByRole("dialog").querySelector("pre");
    expect(pre).not.toBeNull();
    const payload = JSON.parse(pre!.textContent ?? "");
    expect(payload).toEqual({
      $id: "note-abc",
      $type: "note",
      $ownerId: "owner-1",
      $dataContractId: "contract-1",
      $revision: 2,
      $createdAt: 1_700_000_000_000,
      $updatedAt: 1_700_000_005_000,
      title: "Groceries",
      message: "milk, eggs",
    });
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <NoteJsonDrawer
        open
        note={note}
        contractId="contract-1"
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the scrim is clicked but not the inner panel", () => {
    const onClose = vi.fn();
    render(
      <NoteJsonDrawer
        open
        note={note}
        contractId="contract-1"
        onClose={onClose}
      />,
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.querySelector("aside")!);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the Close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <NoteJsonDrawer
        open
        note={note}
        contractId="contract-1"
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("detaches the Escape listener when closed", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <NoteJsonDrawer
        open
        note={note}
        contractId="contract-1"
        onClose={onClose}
      />,
    );
    rerender(
      <NoteJsonDrawer
        open={false}
        note={note}
        contractId="contract-1"
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
