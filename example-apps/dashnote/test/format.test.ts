import { describe, expect, it } from "vitest";

import { noteDisplayTitle, notePreview } from "../src/lib/format";

describe("noteDisplayTitle", () => {
  it("prefers the explicit title", () => {
    expect(
      noteDisplayTitle({ title: "Explicit", message: "First line\nSecond" }),
    ).toBe("Explicit");
  });

  it("falls back to the first non-empty body line, then Untitled", () => {
    expect(
      noteDisplayTitle({ title: "   ", message: "\n  Body title \nNext" }),
    ).toBe("Body title");
    expect(noteDisplayTitle({ title: "", message: "   " })).toBe("Untitled");
  });
});

describe("notePreview", () => {
  it("returns a compact preview and handles blank notes", () => {
    expect(notePreview("hello   world")).toBe("hello world");
    expect(notePreview("  ")).toBe("Empty note");
  });
});
