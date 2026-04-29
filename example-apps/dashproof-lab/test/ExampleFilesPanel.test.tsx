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
      ).toBe(fixture.publicPath);
    }
  });

  it("exposes a download link with the fixture's public path", () => {
    render(<ExampleFilesPanel />);
    const fixture = EXAMPLE_FILE_FIXTURES[0];

    const links = screen.getAllByRole("link", { name: /download fixture/i });
    const link = links.find(
      (anchor) => anchor.getAttribute("href") === fixture.publicPath,
    );
    expect(link).toBeTruthy();
    expect(link?.getAttribute("download")).toBe(fixture.filename);
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
