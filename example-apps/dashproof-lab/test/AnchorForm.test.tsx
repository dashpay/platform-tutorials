// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnchorForm } from "../src/components/AnchorForm";
import { EXAMPLE_FILE_FIXTURES } from "../src/data/exampleFiles";
import { formatHashBlocks } from "../src/lib/format";

const { mockUseSession, mockHashFile, mockCreateAnchor } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockHashFile: vi.fn(),
  mockCreateAnchor: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/lib/hash", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/hash")>();
  return {
    ...actual,
    hashFile: mockHashFile,
  };
});

vi.mock("../src/dash/createAnchor", () => ({
  createAnchor: mockCreateAnchor,
}));

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    status: "readonly",
    sdk: { documents: {} },
    keyManager: null,
    log: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockHashFile.mockReset();
  mockCreateAnchor.mockReset();
  mockUseSession.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AnchorForm", () => {
  it("shows local hash preview, explains chainId, and keeps submission gated behind login", async () => {
    mockUseSession.mockReturnValue(makeSession());
    mockHashFile.mockResolvedValue(
      Uint8Array.from(Buffer.from(EXAMPLE_FILE_FIXTURES[0].sha256Hex, "hex")),
    );

    render(
      <AnchorForm
        contractId="contract-1"
        onAnchored={vi.fn()}
        onLoginPrompt={vi.fn()}
      />,
    );

    const file = new File(["proof"], EXAMPLE_FILE_FIXTURES[0].filename, {
      type: "text/plain",
    });
    fireEvent.change(screen.getByLabelText(/select file/i), {
      target: { files: [file] },
    });

    await screen.findByText("SHA-256 computed locally in the browser.");
    expect(screen.getByText(/drop file or click to select/i)).toBeTruthy();
    expect(screen.getByText(EXAMPLE_FILE_FIXTURES[0].filename)).toBeTruthy();
    expect(screen.getByText("5 B")).toBeTruthy();
    expect((screen.getByLabelText(/chain id/i) as HTMLInputElement).value).toBe(
      EXAMPLE_FILE_FIXTURES[0].chainId,
    );
    expect(
      screen.getByText(/group related proofs \(e\.g\. invoice-2026-04\)/i),
    ).toBeTruthy();
    expect(
      screen.getByText(
        (_, node) =>
          node?.textContent ===
          formatHashBlocks(EXAMPLE_FILE_FIXTURES[0].sha256Hex),
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /copy hash/i })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /login to create proof/i }),
    ).toBeTruthy();
  });

  it("submits a proof when authenticated", async () => {
    mockUseSession.mockReturnValue(
      makeSession({
        status: "authenticated",
        keyManager: { getAuth: vi.fn() },
      }),
    );
    mockHashFile.mockResolvedValue(new Uint8Array(32).fill(1));
    mockCreateAnchor.mockResolvedValue(undefined);
    const onAnchored = vi.fn();

    render(
      <AnchorForm
        contractId="contract-1"
        onAnchored={onAnchored}
        onLoginPrompt={vi.fn()}
      />,
    );

    const file = new File(["proof"], "proof.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText(/select file/i), {
      target: { files: [file] },
    });
    fireEvent.change(screen.getByLabelText(/chain id/i), {
      target: { value: "chain-1" },
    });
    fireEvent.change(screen.getByLabelText(/add context/i), {
      target: { value: "  hello  " },
    });

    await screen.findByText("SHA-256 computed locally in the browser.");

    fireEvent.click(screen.getByRole("button", { name: /create proof/i }));

    await waitFor(() => {
      expect(mockCreateAnchor).toHaveBeenCalledWith(
        expect.objectContaining({
          contractId: "contract-1",
          anchor: expect.objectContaining({
            chainId: "chain-1",
            filename: "proof.txt",
            mimeType: "text/plain",
            note: "  hello  ",
          }),
        }),
      );
    });
    expect(onAnchored).toHaveBeenCalled();
  });

  it("auto-fills from the filename, preserves manual edits, and resumes after clearing", async () => {
    mockUseSession.mockReturnValue(makeSession());
    mockHashFile.mockResolvedValue(new Uint8Array(32).fill(7));

    render(
      <AnchorForm
        contractId="contract-1"
        onAnchored={vi.fn()}
        onLoginPrompt={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/select file/i), {
      target: {
        files: [
          new File(["proof"], "Quarterly Audit Report.pdf", {
            type: "application/pdf",
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(
        (screen.getByLabelText(/chain id/i) as HTMLInputElement).value,
      ).toBe("quarterly-audit-report");
    });

    fireEvent.change(screen.getByLabelText(/chain id/i), {
      target: { value: "custom-chain" },
    });

    fireEvent.change(screen.getByLabelText(/select file/i), {
      target: {
        files: [
          new File(["proof"], "Second Draft.txt", {
            type: "text/plain",
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(
        (screen.getByLabelText(/chain id/i) as HTMLInputElement).value,
      ).toBe("custom-chain");
    });

    fireEvent.change(screen.getByLabelText(/chain id/i), {
      target: { value: "" },
    });

    fireEvent.change(screen.getByLabelText(/select file/i), {
      target: {
        files: [
          new File(["proof"], "Release Notes 2026.md", {
            type: "text/markdown",
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(
        (screen.getByLabelText(/chain id/i) as HTMLInputElement).value,
      ).toBe("release-notes-2026");
    });
  });

  it("accepts a dropped file through the dropzone", async () => {
    mockUseSession.mockReturnValue(makeSession());
    mockHashFile.mockResolvedValue(new Uint8Array(32).fill(9));

    render(
      <AnchorForm
        contractId="contract-1"
        onAnchored={vi.fn()}
        onLoginPrompt={vi.fn()}
      />,
    );

    const file = new File(["dropped"], "drop-proof.txt", {
      type: "text/plain",
    });
    fireEvent.drop(screen.getByRole("button", { name: /file dropzone/i }), {
      dataTransfer: { files: [file] },
    });

    await screen.findByText("SHA-256 computed locally in the browser.");
    expect(screen.getByText("drop-proof.txt")).toBeTruthy();
    expect(mockHashFile).toHaveBeenCalledWith(file);
  });
});
