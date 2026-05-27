// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileActionSheet } from "../src/components/MobileActionSheet";

afterEach(() => {
  cleanup();
});

function renderSheet(onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <MobileActionSheet open title="Note actions" onClose={onClose}>
        <button type="button">First action</button>
        <button type="button">Second action</button>
      </MobileActionSheet>,
    ),
  };
}

describe("MobileActionSheet", () => {
  it("labels the modal dialog from the visible sheet title", () => {
    renderSheet();

    expect(screen.getByRole("dialog", { name: /note actions/i })).toBeTruthy();
  });

  it("moves focus to the first action when opened", () => {
    renderSheet();

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /first action/i }),
    );
  });

  it("calls onClose when Escape is pressed", () => {
    const { onClose } = renderSheet();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", () => {
    const { onClose } = renderSheet();

    fireEvent.click(screen.getByTestId("mobile-action-sheet-backdrop"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps tab focus inside the sheet", () => {
    renderSheet();

    const first = screen.getByRole("button", { name: /first action/i });
    const cancel = screen.getByRole("button", { name: /^cancel$/i });

    cancel.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(cancel);
  });

  it("restores the previous focus target when closed", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Launcher
          </button>
          <MobileActionSheet
            open={open}
            title="Note actions"
            onClose={() => setOpen(false)}
          >
            <button type="button">First action</button>
          </MobileActionSheet>
        </>
      );
    }

    render(<Harness />);
    const launcher = screen.getByRole("button", { name: /launcher/i });
    launcher.focus();
    fireEvent.click(launcher);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /first action/i }),
    );

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(document.activeElement).toBe(launcher);
  });
});
