// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HistoryPanel } from "../src/components/HistoryPanel";

const { mockUseSession, mockListAnchorsByOwner, mockListAnchorsByChain } =
  vi.hoisted(() => ({
    mockUseSession: vi.fn(),
    mockListAnchorsByOwner: vi.fn(),
    mockListAnchorsByChain: vi.fn(),
  }));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/dash/queries", () => ({
  listAnchorsByOwner: mockListAnchorsByOwner,
  listAnchorsByChain: mockListAnchorsByChain,
}));

beforeEach(() => {
  mockUseSession.mockReset();
  mockListAnchorsByOwner.mockReset();
  mockListAnchorsByChain.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("HistoryPanel", () => {
  it("loads owner history for authenticated users", async () => {
    mockUseSession.mockReturnValue({
      status: "authenticated",
      sdk: {},
      identityId: "owner-1",
      log: vi.fn(),
    });
    mockListAnchorsByOwner.mockResolvedValue([
      {
        id: "anchor-1",
        ownerId: "owner-1",
        createdAt: 1710000000000,
        entryHash: Uint8Array.from([1]),
        entryHashHex: "01",
        chainId: "my-chain",
        filename: "proof.txt",
      },
    ]);

    render(<HistoryPanel contractId="contract-1" refreshKey={0} />);

    await screen.findByText("my-chain");
    expect(mockListAnchorsByOwner).toHaveBeenCalled();
  });

  it("loads chain history in read-only mode", async () => {
    mockUseSession.mockReturnValue({
      status: "readonly",
      sdk: {},
      identityId: null,
      log: vi.fn(),
    });
    mockListAnchorsByChain.mockResolvedValue([
      {
        id: "anchor-2",
        ownerId: "owner-2",
        createdAt: 1710000000000,
        entryHash: Uint8Array.from([2]),
        entryHashHex: "02",
        chainId: "chain-a",
        filename: "proof.txt",
      },
    ]);

    render(<HistoryPanel contractId="contract-1" refreshKey={0} />);
    fireEvent.change(screen.getByPlaceholderText("invoice-2026-04"), {
      target: { value: "chain-a" },
    });
    fireEvent.click(screen.getByRole("button", { name: /load chain/i }));

    await waitFor(() => {
      expect(mockListAnchorsByChain).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: "chain-a",
        }),
      );
    });
    await screen.findByText("proof.txt");
    expect(screen.getByDisplayValue("chain-a")).toBeTruthy();
    expect(screen.getByText("proof.txt")).toBeTruthy();
  });
});
