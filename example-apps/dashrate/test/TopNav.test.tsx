// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TopNav, type View } from "../src/components/TopNav";

afterEach(() => {
  cleanup();
});

const NAV: { label: RegExp; view: View }[] = [
  { label: /^resources$/i, view: "resources" },
  { label: /^my reviews$/i, view: "my-reviews" },
  { label: /^settings$/i, view: "settings" },
  { label: /^how it works$/i, view: "how" },
];

describe("TopNav", () => {
  it("renders the brand heading and all four nav buttons", () => {
    render(<TopNav view="resources" onViewChange={() => {}} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "DashRate",
    );
    for (const { label } of NAV) {
      // getByRole throws if the named button is missing; assert it's a real,
      // enabled <button> rather than just truthy.
      const button = screen.getByRole("button", { name: label });
      expect(button.tagName).toBe("BUTTON");
      expect((button as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it("marks only the active view with aria-current and the active class", () => {
    render(<TopNav view="settings" onViewChange={() => {}} />);
    const settings = screen.getByRole("button", { name: /^settings$/i });
    expect(settings.getAttribute("aria-current")).toBe("page");
    expect(settings.className).toBe("active");

    const resources = screen.getByRole("button", { name: /^resources$/i });
    expect(resources.getAttribute("aria-current")).toBeNull();
    expect(resources.className).toBe("");
  });

  it("calls onViewChange with the matching view for each button", () => {
    const onViewChange = vi.fn();
    render(<TopNav view="resources" onViewChange={onViewChange} />);
    for (const { label, view } of NAV) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(onViewChange).toHaveBeenCalledWith(view);
    }
    expect(onViewChange).toHaveBeenCalledTimes(NAV.length);
  });
});
