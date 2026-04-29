// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExampleFilesPanel } from "../src/components/ExampleFilesPanel";
import { EXAMPLE_FILE_FIXTURES } from "../src/data/exampleFiles";

let writeTextMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeTextMock = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: writeTextMock },
  });
});

afterEach(() => {
  cleanup();
});

function expectedHref(publicPath: string): string {
  // Mirrors resolveFixtureHref in ExampleFilesPanel: BASE_URL ('/' in tests)
  // joined to a leading-slash-stripped publicPath.
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const trimmed = publicPath.startsWith("/") ? publicPath.slice(1) : publicPath;
  return `${base}${trimmed}`;
}

describe("ExampleFilesPanel", () => {
  it("renders one row per fixture with filename, hash, and chain id", () => {
    const { container } = render(<ExampleFilesPanel />);

    const rows = container.querySelectorAll("article");
    expect(rows).toHaveLength(EXAMPLE_FILE_FIXTURES.length);

    for (const [index, fixture] of EXAMPLE_FILE_FIXTURES.entries()) {
      const row = rows[index] as HTMLElement;
      expect(within(row).getByText(fixture.label)).toBeTruthy();
      expect(within(row).getByText(fixture.filename)).toBeTruthy();
      expect(within(row).getByText(fixture.note)).toBeTruthy();
      expect(within(row).getByText(fixture.sha256Hex)).toBeTruthy();
      expect(within(row).getByText(fixture.chainId)).toBeTruthy();
      expect(
        within(row)
          .getByRole("link", { name: /download fixture/i })
          .getAttribute("href"),
      ).toBe(expectedHref(fixture.publicPath));
    }
  });

  it("resolves the download href against import.meta.env.BASE_URL so sub-path deploys work", () => {
    render(<ExampleFilesPanel />);
    const fixture = EXAMPLE_FILE_FIXTURES[0];

    const links = screen.getAllByRole("link", { name: /download fixture/i });
    const link = links.find(
      (anchor) =>
        anchor.getAttribute("href") === expectedHref(fixture.publicPath),
    );
    expect(link).toBeTruthy();
    expect(link?.getAttribute("download")).toBe(fixture.filename);

    // The resolved href must never start with "//" (which would resolve as
    // an absolute URL on the parent origin), and must end with the fixture
    // filename so the browser still downloads the right asset.
    const href = link!.getAttribute("href")!;
    expect(href.startsWith("//")).toBe(false);
    expect(href.endsWith(fixture.filename)).toBe(true);
  });

  it("copies the suggested chain id when the copy button is clicked", () => {
    render(<ExampleFilesPanel />);

    const buttons = screen.getAllByRole("button", {
      name: /copy suggested chain/i,
    });
    expect(buttons.length).toBe(EXAMPLE_FILE_FIXTURES.length);

    fireEvent.click(buttons[0]);
    expect(writeTextMock).toHaveBeenCalledWith(
      EXAMPLE_FILE_FIXTURES[0].chainId,
    );
  });
});
