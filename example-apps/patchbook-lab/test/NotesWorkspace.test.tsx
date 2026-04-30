// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotesWorkspace } from "../src/components/NotesWorkspace";

const {
  mockUseSession,
  mockListMyNotes,
  mockGetNote,
  mockCreateNote,
  mockUpdateNote,
  mockDeleteNote,
} = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockListMyNotes: vi.fn(),
  mockGetNote: vi.fn(),
  mockCreateNote: vi.fn(),
  mockUpdateNote: vi.fn(),
  mockDeleteNote: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mockUseSession,
}));

vi.mock("../src/dash/queries", () => ({
  listMyNotes: mockListMyNotes,
  getNote: mockGetNote,
}));

vi.mock("../src/dash/createNote", () => ({
  createNote: mockCreateNote,
}));

vi.mock("../src/dash/updateNote", () => ({
  updateNote: mockUpdateNote,
}));

vi.mock("../src/dash/deleteNote", () => ({
  deleteNote: mockDeleteNote,
}));

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    status: "authenticated",
    sdk: {},
    keyManager: {},
    contractId: "contract-1",
    identityId: "identity-1",
    log: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockUseSession.mockReset();
  mockListMyNotes.mockReset();
  mockGetNote.mockReset();
  mockCreateNote.mockReset();
  mockUpdateNote.mockReset();
  mockDeleteNote.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NotesWorkspace", () => {
  it("shows auth gating when the session is not authenticated", () => {
    mockUseSession.mockReturnValue(
      makeSession({
        status: "readonly",
        keyManager: null,
        identityId: null,
      }),
    );

    render(<NotesWorkspace onOpenSettings={vi.fn()} />);

    expect(screen.getByText(/login required/i)).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: /new note/i })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("creates a body-only note and reloads the list", async () => {
    mockUseSession.mockReturnValue(makeSession());
    mockListMyNotes.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: "note-1",
        ownerId: "identity-1",
        title: null,
        message: "Body only",
        createdAt: 1000,
        updatedAt: 2000,
        revision: 0,
      },
    ]);
    mockGetNote.mockResolvedValue({
      id: "note-1",
      ownerId: "identity-1",
      title: null,
      message: "Body only",
      createdAt: 1000,
      updatedAt: 2000,
      revision: 0,
    });
    mockCreateNote.mockResolvedValue("note-1");

    render(<NotesWorkspace onOpenSettings={vi.fn()} />);

    await waitFor(() => {
      expect(mockListMyNotes).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /new note/i }));
    fireEvent.change(screen.getByLabelText(/body/i), {
      target: { value: "Body only" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create note/i }));

    await waitFor(() => {
      expect(mockCreateNote).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "",
          message: "Body only",
        }),
      );
    });
    await waitFor(() => {
      expect(mockListMyNotes).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByDisplayValue("Body only")).toBeTruthy();
  });

  it("shows the empty notebook state for a valid contract with no notes", async () => {
    mockUseSession.mockReturnValue(makeSession());
    mockListMyNotes.mockResolvedValue([]);

    render(<NotesWorkspace onOpenSettings={vi.fn()} />);

    await waitFor(() => {
      expect(mockListMyNotes).toHaveBeenCalledTimes(1);
    });
    expect(screen.getAllByText(/no notes yet/i)[0]).toBeTruthy();
    expect(screen.getByText(/0 notes/i)).toBeTruthy();
  });

  it("updates an existing note and shows delete flow", async () => {
    mockUseSession.mockReturnValue(makeSession());
    const note = {
      id: "note-2",
      ownerId: "identity-1",
      title: "Original",
      message: "Hello",
      createdAt: 1000,
      updatedAt: 2000,
      revision: 2,
    };
    const updated = { ...note, title: "Edited", updatedAt: 3000, revision: 3 };
    mockListMyNotes.mockResolvedValue([note]);
    mockGetNote.mockResolvedValueOnce(note).mockResolvedValueOnce(updated);
    mockUpdateNote.mockResolvedValue(undefined);
    mockDeleteNote.mockResolvedValue(undefined);

    render(<NotesWorkspace onOpenSettings={vi.fn()} />);

    await waitFor(() => {
      expect(mockGetNote).toHaveBeenCalledWith(
        expect.objectContaining({ noteId: "note-2" }),
      );
    });

    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Edited" },
    });
    const saveButton = screen.getByRole("button", { name: /^save$/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalledWith(
        expect.objectContaining({
          noteId: "note-2",
          title: "Edited",
          message: "Hello",
        }),
      );
    });

    // After update, detail should be refetched (mockGetNote called again with same id)
    await waitFor(() => {
      expect(mockGetNote).toHaveBeenCalledTimes(2);
    });

    // Save button should disable once baselines match the freshly-loaded values
    await waitFor(() => {
      expect(saveButton.hasAttribute("disabled")).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => {
      expect(mockDeleteNote).toHaveBeenCalledWith(
        expect.objectContaining({ noteId: "note-2" }),
      );
    });
  });

  it("surfaces query failures as a regular editor error", async () => {
    mockUseSession.mockReturnValue(makeSession());
    mockListMyNotes.mockRejectedValue(new Error("Data contract not found"));

    render(<NotesWorkspace onOpenSettings={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/editor error/i)).toBeTruthy();
    });
    expect(screen.getByText("Data contract not found")).toBeTruthy();
  });
});
