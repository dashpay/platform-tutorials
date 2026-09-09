// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { StarMeter } from "../src/components/StarMeter";

afterEach(cleanup);

function fill(container: HTMLElement) {
  return container.querySelector<HTMLElement>(".star-meter-fill")!;
}

it("fills proportionally and labels the average", () => {
  const { container } = render(<StarMeter value={4.3} />);
  expect(fill(container).style.width).toBe("86%");
  expect(
    container.querySelector(".star-meter")?.getAttribute("aria-label"),
  ).toBe("4.3 out of 5 stars");
});

it("renders an empty meter for no rating and clamps out-of-range values", () => {
  const empty = render(<StarMeter value={null} />);
  expect(fill(empty.container).style.width).toBe("0%");
  expect(
    empty.container.querySelector(".star-meter")?.getAttribute("aria-label"),
  ).toBe("No rating yet");
  cleanup();
  const high = render(<StarMeter value={9} className="small" label="Nine" />);
  expect(fill(high.container).style.width).toBe("100%");
  expect(
    high.container
      .querySelector(".star-meter.small")
      ?.getAttribute("aria-label"),
  ).toBe("Nine");
});
