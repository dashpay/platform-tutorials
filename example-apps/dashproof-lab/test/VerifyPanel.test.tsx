// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VerifyPanel } from "../src/components/VerifyPanel";
import { formatHashBlocks } from "../src/lib/format";

const { mockUseSession, mockHashFile, mockFindAnchorByHash } = vi.hoisted(
  () => ({
    mockUseSession: vi.fn(),
    mockHashFile: vi.fn(),
    mockFindAnchorByHash: vi.fn(),
  }),
);

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

vi.mock("../src/dash/queries", () => ({
  findAnchorByHash: mockFindAnchorByHash,
}));

beforeEach(() => {
  mockUseSession.mockReset();
  mockHashFile.mockReset();
  mockFindAnchorByHash.mockReset();
  mockUseSession.mockReturnValue({
    status: "readonly",
    sdk: {},
    log: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("VerifyPanel", () => {
  it("verifies a file hash without requiring login", async () => {
    const digest = Uint8Array.from([0x01, 0x02]);
    mockHashFile.mockResolvedValue(digest);
    mockFindAnchorByHash.mockResolvedValue({
      id: "anchor-1",
      ownerId: "owner-1",
      createdAt: 1710000000000,
      entryHash: Uint8Array.from([0x01, 0x02]),
      entryHashHex: "0102",
      chainId: "chain-a",
      filename: "proof.txt",
      mimeType: "text/plain",
      size: 12,
      note: "anchored",
    });

    const onViewChainHistory = vi.fn();
    render(
      <VerifyPanel
        contractId="contract-1"
        onViewChainHistory={onViewChainHistory}
      />,
    );

    const file = new File(["proof"], "proof.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText(/select file/i), {
      target: { files: [file] },
    });
    await screen.findByText(
      "Dash Platform has a matching proof for this file.",
    );
    await waitFor(() => {
      expect(mockFindAnchorByHash).toHaveBeenCalledWith(
        expect.objectContaining({
          contractId: "contract-1",
          entryHash: digest,
        }),
      );
    });
    expect(screen.getByText(/drop file or click to select/i)).toBeTruthy();
    expect(screen.getByText(formatHashBlocks("0102"))).toBeTruthy();
    expect(screen.getByRole("button", { name: /copy hash/i })).toBeTruthy();
    const matchingAnchor = screen.getByText("Matching proof").closest("div");
    expect(matchingAnchor).toBeTruthy();
    const resultPanel = matchingAnchor?.parentElement;
    expect(resultPanel).toBeTruthy();
    expect(
      within(resultPanel as HTMLElement).getByText("chain-a"),
    ).toBeTruthy();
    expect(
      within(resultPanel as HTMLElement).getByText("proof.txt"),
    ).toBeTruthy();
    expect(
      within(resultPanel as HTMLElement).getByText("anchored"),
    ).toBeTruthy();
    fireEvent.click(
      within(resultPanel as HTMLElement).getByRole("button", {
        name: /view chain history/i,
      }),
    );
    expect(onViewChainHistory).toHaveBeenCalledWith("chain-a");
  });

  it("shows an explicit miss state when no proof exists", async () => {
    mockHashFile.mockResolvedValue(Uint8Array.from([0x01, 0x02]));
    mockFindAnchorByHash.mockResolvedValue(null);

    render(<VerifyPanel contractId="contract-1" />);

    const file = new File(["proof"], "proof.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText(/select file/i), {
      target: { files: [file] },
    });
    await screen.findByText(
      "Dash Platform does not have a matching proof for this file hash.",
    );
    expect(screen.getByText("proof.txt")).toBeTruthy();
  });

  it("clears the previous verify status when a different file is selected", async () => {
    mockHashFile
      .mockResolvedValueOnce(Uint8Array.from([0x01, 0x02]))
      .mockResolvedValueOnce(Uint8Array.from([0x03, 0x04]));
    mockFindAnchorByHash.mockResolvedValue(null);

    render(<VerifyPanel contractId="contract-1" />);

    fireEvent.change(screen.getByLabelText(/select file/i), {
      target: {
        files: [new File(["proof"], "proof-a.txt", { type: "text/plain" })],
      },
    });
    await screen.findByText(
      "Dash Platform does not have a matching proof for this file hash.",
    );

    fireEvent.change(screen.getByLabelText(/select file/i), {
      target: {
        files: [new File(["proof"], "proof-b.txt", { type: "text/plain" })],
      },
    });

    expect(
      screen.queryByText(
        "Dash Platform does not have a matching proof for this file hash.",
      ),
    ).toBeNull();
    expect(screen.getAllByText("Computing hash…").length).toBeGreaterThan(0);
  });

  it("accepts a dropped file through the dropzone", async () => {
    mockHashFile.mockResolvedValue(Uint8Array.from([0x01, 0x02]));
    mockFindAnchorByHash.mockResolvedValue(null);

    render(<VerifyPanel contractId="contract-1" />);

    const file = new File(["proof"], "drop-verify.txt", { type: "text/plain" });
    fireEvent.drop(screen.getByRole("button", { name: /file dropzone/i }), {
      dataTransfer: { files: [file] },
    });

    await screen.findByText(
      "Dash Platform does not have a matching proof for this file hash.",
    );
    expect(screen.getByText("drop-verify.txt")).toBeTruthy();
    expect(mockHashFile).toHaveBeenCalledWith(file);
  });
});
