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

const { mockUseSession, mockHashFile, mockCreateAnchor, mockFindAnchorByHash } =
  vi.hoisted(() => ({
    mockUseSession: vi.fn(),
    mockHashFile: vi.fn(),
    mockCreateAnchor: vi.fn(),
    mockFindAnchorByHash: vi.fn(),
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

vi.mock("../src/dash/queries", () => ({
  findAnchorByHash: mockFindAnchorByHash,
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
  mockFindAnchorByHash.mockReset();
  mockFindAnchorByHash.mockResolvedValue(null);
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

    await waitFor(() => {
      expect(
        (
          screen.getByRole("button", {
            name: /create proof/i,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    });
    const form = screen.getByLabelText(/chain id/i).closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);
    expect(mockCreateAnchor).toHaveBeenCalledTimes(1);
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

  it("warns and blocks submit when the file is already anchored", async () => {
    mockUseSession.mockReturnValue(
      makeSession({
        status: "authenticated",
        keyManager: { getAuth: vi.fn() },
      }),
    );
    mockHashFile.mockResolvedValue(new Uint8Array(32).fill(1));
    mockFindAnchorByHash.mockResolvedValue({
      id: "anchor-1",
      ownerId: "ownerabcdef0123456789",
      createdAt: 1700000000000,
      entryHash: new Uint8Array(32).fill(1),
      entryHashHex: "01".repeat(32),
      chainId: "existing-chain",
    });
    const onViewChainHistory = vi.fn();

    render(
      <AnchorForm
        contractId="contract-1"
        onAnchored={vi.fn()}
        onLoginPrompt={vi.fn()}
        onViewChainHistory={onViewChainHistory}
      />,
    );

    fireEvent.change(screen.getByLabelText(/select file/i), {
      target: {
        files: [new File(["proof"], "dupe.txt", { type: "text/plain" })],
      },
    });
    fireEvent.change(screen.getByLabelText(/chain id/i), {
      target: { value: "chain-1" },
    });

    await screen.findByText("Already anchored");
    expect(mockFindAnchorByHash).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: "contract-1" }),
    );
    // The submit CTA is removed entirely while a duplicate is detected.
    expect(screen.queryByRole("button", { name: /create proof/i })).toBeNull();
    const form = screen.getByLabelText(/chain id/i).closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);
    expect(mockCreateAnchor).not.toHaveBeenCalled();

    // The chain ID links into that chain's history.
    fireEvent.click(screen.getByRole("button", { name: "existing-chain" }));
    expect(onViewChainHistory).toHaveBeenCalledWith("existing-chain");
  });

  it("allows submit and shows no warning when the file is not yet anchored", async () => {
    mockUseSession.mockReturnValue(
      makeSession({
        status: "authenticated",
        keyManager: { getAuth: vi.fn() },
      }),
    );
    mockHashFile.mockResolvedValue(new Uint8Array(32).fill(2));
    mockFindAnchorByHash.mockResolvedValue(null);

    render(
      <AnchorForm
        contractId="contract-1"
        onAnchored={vi.fn()}
        onLoginPrompt={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/select file/i), {
      target: {
        files: [new File(["fresh"], "fresh.txt", { type: "text/plain" })],
      },
    });
    fireEvent.change(screen.getByLabelText(/chain id/i), {
      target: { value: "chain-1" },
    });

    await screen.findByText("SHA-256 computed locally in the browser.");

    await waitFor(() => {
      expect(
        (
          screen.getByRole("button", {
            name: /create proof/i,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    });
    expect(screen.queryByText("Already anchored")).toBeNull();
  });
});
