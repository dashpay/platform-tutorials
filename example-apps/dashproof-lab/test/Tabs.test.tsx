// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Tabs } from "../src/components/Tabs";

afterEach(() => {
  cleanup();
});

describe("Tabs", () => {
  it("renders all tabs and marks the active one", () => {
    render(<Tabs value="verify" onChange={() => {}} />);

    const active = screen.getByRole("button", { name: /verify proof/i });
    const inactive = screen.getByRole("button", { name: /create proof/i });

    expect(active.className).toMatch(/bg-accent/);
    expect(inactive.className).not.toMatch(/bg-accent\b/);
  });

  it("invokes onChange with the clicked tab id", () => {
    const onChange = vi.fn();
    render(<Tabs value="anchor" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /history/i }));
    expect(onChange).toHaveBeenLastCalledWith("history");

    fireEvent.click(screen.getByRole("button", { name: /how it works/i }));
    expect(onChange).toHaveBeenLastCalledWith("how-it-works");
  });

  it("renders a glyph alongside each label", () => {
    render(<Tabs value="anchor" onChange={() => {}} />);

    const cases = [
      { label: /create proof/i, glyph: "#" },
      { label: /verify proof/i, glyph: "?" },
      { label: /history/i, glyph: "↺" },
      { label: /how it works/i, glyph: "i" },
    ];

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(cases.length);

    for (const { label, glyph } of cases) {
      const button = screen.getByRole("button", { name: label });
      expect(within(button).getByText(glyph)).toBeTruthy();
    }
  });
});
