// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CopyButton } from "../src/components/CopyButton";

let writeTextMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeTextMock = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: writeTextMock },
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("CopyButton", () => {
  it("writes the value to the clipboard and fires onCopied", () => {
    const onCopied = vi.fn();
    render(
      <CopyButton value="hello-world" label="Greeting" onCopied={onCopied} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /copy greeting/i }));

    expect(writeTextMock).toHaveBeenCalledWith("hello-world");
    expect(onCopied).toHaveBeenCalledWith("Greeting");
  });

  it("flips to a success state after click and reverts after the timeout", () => {
    render(<CopyButton value="abc" label="Hash" />);
    const button = screen.getByRole("button", { name: /copy hash/i });

    // Idle: shows the clipboard icon (rect element); never the check (path d^M3 8.5).
    expect(button.querySelector("rect")).not.toBeNull();
    const checkBefore = button.querySelector('path[d^="M3 8.5"]');
    expect(checkBefore).toBeNull();

    fireEvent.click(button);
    // Success: check icon present, clipboard rect gone.
    expect(button.querySelector('path[d^="M3 8.5"]')).not.toBeNull();
    expect(button.querySelector("rect")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(button.querySelector("rect")).not.toBeNull();
    expect(button.querySelector('path[d^="M3 8.5"]')).toBeNull();
  });

  it("does not bubble click events to ancestor handlers", () => {
    const ancestorClick = vi.fn();
    render(
      <div onClick={ancestorClick}>
        <CopyButton value="x" label="Item" />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: /copy item/i }));

    expect(writeTextMock).toHaveBeenCalledWith("x");
    expect(ancestorClick).not.toHaveBeenCalled();
  });
});
