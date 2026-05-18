// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActivityPanel } from "../src/components/ActivityPanel";
import type { LogEntry } from "../src/lib/logger";

const { mockUseSession, mockClearActivityLog } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockClearActivityLog: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

function makeEntries(): LogEntry[] {
  return [
    {
      id: "entry-1",
      level: "success",
      message: "Note saved.",
      detail: "rev 2",
      timestamp: Date.now(),
    },
    {
      id: "entry-2",
      level: "info",
      message: "Saving note abc12345…",
      detail: "documents.get → replace",
      timestamp: Date.now() - 1000,
    },
    {
      id: "entry-3",
      level: "error",
      message: "Login failed: bad key",
      timestamp: Date.now() - 2000,
    },
  ];
}

beforeEach(() => {
  mockUseSession.mockReset();
  mockClearActivityLog.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("ActivityPanel", () => {
  it("renders nothing when closed", () => {
    mockUseSession.mockReturnValue({
      activityLog: makeEntries(),
      clearActivityLog: mockClearActivityLog,
    });
    const { container } = render(
      <ActivityPanel open={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders an empty-state message when there is no activity", () => {
    mockUseSession.mockReturnValue({
      activityLog: [],
      clearActivityLog: mockClearActivityLog,
    });
    render(<ActivityPanel open onClose={vi.fn()} />);
    expect(screen.getByText(/no activity yet/i)).toBeTruthy();
  });

  it("renders entries with messages and details", () => {
    mockUseSession.mockReturnValue({
      activityLog: makeEntries(),
      clearActivityLog: mockClearActivityLog,
    });
    render(<ActivityPanel open onClose={vi.fn()} />);

    expect(screen.getByText("Note saved.")).toBeTruthy();
    expect(screen.getByText("rev 2")).toBeTruthy();
    expect(screen.getByText("documents.get → replace")).toBeTruthy();
    expect(screen.getByText("Login failed: bad key")).toBeTruthy();
  });

  it("clears the log when Clear is clicked", () => {
    mockUseSession.mockReturnValue({
      activityLog: makeEntries(),
      clearActivityLog: mockClearActivityLog,
    });
    render(<ActivityPanel open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(mockClearActivityLog).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", () => {
    mockUseSession.mockReturnValue({
      activityLog: makeEntries(),
      clearActivityLog: mockClearActivityLog,
    });
    const onClose = vi.fn();
    render(<ActivityPanel open onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the scrim is clicked", () => {
    mockUseSession.mockReturnValue({
      activityLog: makeEntries(),
      clearActivityLog: mockClearActivityLog,
    });
    const onClose = vi.fn();
    render(<ActivityPanel open onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalled();
  });
});
