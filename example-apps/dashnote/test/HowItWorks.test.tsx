// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HowItWorks } from "../src/components/HowItWorks";

const REPO =
  "https://github.com/dashpay/platform-tutorials/blob/main/example-apps/dashnote/src/dash/";

afterEach(() => {
  cleanup();
});

describe("HowItWorks", () => {
  it("renders the four-step pipeline diagram", () => {
    render(<HowItWorks />);

    for (const label of ["UI", "Helper", "Evo SDK", "Platform"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText(/data flow/i)).toBeTruthy();
  });

  it("renders an operations link per dash helper, each pointing at the GitHub source", () => {
    render(<HowItWorks />);

    const cases = [
      { op: "Create a note", file: "createNote.ts" },
      { op: "Update a note", file: "updateNote.ts" },
      { op: "Delete a note", file: "deleteNote.ts" },
      { op: "List my notes", file: "queries.ts" },
      { op: "Register a contract", file: "contract.ts" },
    ];

    for (const { op, file } of cases) {
      const link = screen.getByRole("link", { name: new RegExp(op, "i") });
      expect(link.getAttribute("href")).toBe(`${REPO}${file}`);
      expect(link.getAttribute("target")).toBe("_blank");
      // Anchors that open in a new tab need rel="noreferrer" for safety.
      expect(link.getAttribute("rel")).toMatch(/noreferrer/);
    }
  });

  it("renders an inline code peek referencing sdk.documents.create", () => {
    render(<HowItWorks />);

    // "src/dash/createNote.ts" appears in both the code peek header and the
    // suggested reading order list — accept either; we only care the file
    // name is anchored somewhere.
    expect(
      screen.getAllByText(/src\/dash\/createNote\.ts/).length,
    ).toBeGreaterThan(0);
    // "sdk.documents.create" appears in the code peek snippet AND in the
    // intro paragraph above it — accept either; one is enough.
    expect(
      screen.getAllByText((content) => content.includes("sdk.documents.create"))
        .length,
    ).toBeGreaterThan(0);
  });

  it("renders the suggested reading order list", () => {
    render(<HowItWorks />);

    const list = screen.getByRole("list");
    const items = list.querySelectorAll("li");
    expect(items.length).toBeGreaterThanOrEqual(4);
  });

  it("renders each pipeline card as a link to its canonical URL", () => {
    render(<HowItWorks />);

    const cases = [
      {
        label: "UI",
        href: "https://github.com/dashpay/platform-tutorials/blob/main/example-apps/dashnote/src/components/NoteEditor.tsx",
      },
      {
        label: "Helper",
        href: "https://github.com/dashpay/platform-tutorials/tree/main/example-apps/dashnote/src/dash",
      },
      {
        label: "Evo SDK",
        href: "https://www.npmjs.com/package/@dashevo/evo-sdk",
      },
      // Platform card points at the testnet explorer.
      { label: "Platform", href: /platform-explorer/i },
    ];

    for (const { label, href } of cases) {
      const link = screen.getByRole("link", { name: new RegExp(label, "i") });
      if (typeof href === "string") {
        expect(link.getAttribute("href")).toBe(href);
      } else {
        expect(link.getAttribute("href")).toMatch(href);
      }
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toMatch(/noreferrer/);
    }
  });

  it("renders each reading-order row as a link to its GitHub source", () => {
    render(<HowItWorks />);

    const files = [
      "src/dash/contract.ts",
      "src/dash/createNote.ts",
      "src/dash/updateNote.ts",
      "src/components/NotesWorkspace.tsx",
    ];

    for (const file of files) {
      const link = screen.getByRole("link", { name: new RegExp(file, "i") });
      expect(link.getAttribute("href")).toBe(
        `https://github.com/dashpay/platform-tutorials/blob/main/example-apps/dashnote/${file}`,
      );
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toMatch(/noreferrer/);
    }
  });
});
