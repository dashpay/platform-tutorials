// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Modal } from "../src/components/Modal";

afterEach(() => {
  cleanup();
});

describe("Modal a11y", () => {
  it("renders a labelled dialog when open", () => {
    render(
      <Modal open title="Login" onClose={vi.fn()}>
        <div>body</div>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    const labelledById = dialog.getAttribute("aria-labelledby");
    expect(labelledById).toBeTruthy();

    const heading = document.getElementById(labelledById!);
    expect(heading?.textContent).toBe("Login");
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <Modal open={false} title="Hidden" onClose={vi.fn()}>
        <div>body</div>
      </Modal>,
    );
    expect(container.firstChild).toBeNull();
  });
});
