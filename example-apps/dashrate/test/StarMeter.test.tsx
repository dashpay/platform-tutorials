// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StarMeter } from "../src/components/StarMeter";

afterEach(() => {
  cleanup();
});

function fill(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(".star-meter-fill");
  if (!el) throw new Error("star-meter-fill not found");
  return el;
}

describe("StarMeter", () => {
  it("renders the empty state for a null value", () => {
    const { container } = render(<StarMeter value={null} />);
    const meter = container.querySelector(".star-meter");
    expect(meter?.getAttribute("aria-label")).toBe("No rating yet");
    expect(meter?.getAttribute("role")).toBe("img");
    expect(fill(container).style.width).toBe("0%");
  });

  it("fills proportionally and labels the average for a whole value", () => {
    const { container } = render(<StarMeter value={3} />);
    expect(fill(container).style.width).toBe("60%");
    expect(
      container.querySelector(".star-meter")?.getAttribute("aria-label"),
    ).toBe("3.0 out of 5");
  });

  it("supports partial fills", () => {
    const { container } = render(<StarMeter value={4.5} />);
    expect(fill(container).style.width).toBe("90%");
  });

  it("clamps values above 5 and below 0", () => {
    const high = render(<StarMeter value={7} />);
    expect(fill(high.container).style.width).toBe("100%");
    cleanup();
    const low = render(<StarMeter value={-2} />);
    expect(fill(low.container).style.width).toBe("0%");
  });

  it("appends an extra className to the base class", () => {
    const { container } = render(
      <StarMeter value={2} className="mini-stars" />,
    );
    const meter = container.querySelector(".star-meter");
    expect(meter?.className).toBe("star-meter mini-stars");
  });
});
