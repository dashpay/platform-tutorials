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

// jsdom does not implement matchMedia; stub it so useMediaQuery resolves
// the desired breakpoint. Defaults to desktop; mobile-flavored tests can
// override by calling stubMatchMedia(false) before render.
function stubMatchMedia(isDesktop: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: isDesktop,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  mockUseSession.mockReset();
  mockListMyNotes.mockReset();
  mockGetNote.mockReset();
  mockCreateNote.mockReset();
  mockUpdateNote.mockReset();
  mockDeleteNote.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  stubMatchMedia(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

    const onOpenSettings = vi.fn();
    render(<NotesWorkspace onOpenSettings={onOpenSettings} />);

    expect(screen.getByText(/sign in to see your notes/i)).toBeTruthy();
    const loginButton = screen.getByRole("button", { name: /^log in$/i });
    fireEvent.click(loginButton);
    expect(onOpenSettings).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /new note/i })).toBeNull();

    const bridgeLink = screen.getByRole("link", { name: /dash bridge/i });
    expect(bridgeLink.getAttribute("href")).toBe(
      "https://bridge.thepasta.org/",
    );
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

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
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

  it("shows the no-contract empty state when authed without a contract", () => {
    mockUseSession.mockReturnValue(makeSession({ contractId: null }));
    const onOpenSettings = vi.fn();

    render(<NotesWorkspace onOpenSettings={onOpenSettings} />);

    expect(screen.getByText(/register or select a contract/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /open settings/i }));
    expect(onOpenSettings).toHaveBeenCalled();
    // List/editor chrome should not render in this branch.
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByLabelText(/^body$/i)).toBeNull();
  });

  it("filters the list with the search input", async () => {
    // Use mobile layout so only the list pane renders; otherwise the
    // auto-selected note's title would render in the editor pane too and
    // confuse text-presence assertions.
    stubMatchMedia(false);
    mockUseSession.mockReturnValue(makeSession());
    const notes = [
      {
        id: "n1",
        ownerId: "identity-1",
        title: "Grocery list",
        message: "milk, eggs, bread",
        createdAt: 1,
        updatedAt: 10,
        revision: 0,
      },
      {
        id: "n2",
        ownerId: "identity-1",
        title: "Travel ideas",
        message: "Lisbon, Tokyo",
        createdAt: 2,
        updatedAt: 20,
        revision: 0,
      },
      {
        id: "n3",
        ownerId: "identity-1",
        title: null,
        message: "Random shower thought",
        createdAt: 3,
        updatedAt: 30,
        revision: 0,
      },
    ];
    mockListMyNotes.mockResolvedValue(notes);
    mockGetNote.mockResolvedValue(notes[0]);

    render(<NotesWorkspace onOpenSettings={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Grocery list")).toBeTruthy();
    });

    const search = screen.getByPlaceholderText(/search/i);

    fireEvent.change(search, { target: { value: "tokyo" } });
    expect(screen.queryByText("Grocery list")).toBeNull();
    expect(screen.getByText("Travel ideas")).toBeTruthy();
    expect(screen.queryByText("Random shower thought")).toBeNull();

    fireEvent.change(search, { target: { value: "zzz-no-match" } });
    expect(screen.getByText(/no notes match that search/i)).toBeTruthy();

    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getByText("Grocery list")).toBeTruthy();
    expect(screen.getByText("Travel ideas")).toBeTruthy();
  });

  describe("mobile", () => {
    beforeEach(() => {
      stubMatchMedia(false);
    });

    const noteFixture = {
      id: "note-mobile",
      ownerId: "identity-1",
      title: "Phone note",
      message: "Tap target",
      createdAt: 1000,
      updatedAt: 2000,
      revision: 1,
    };

    it("does not auto-select the first note on load", async () => {
      mockUseSession.mockReturnValue(makeSession());
      mockListMyNotes.mockResolvedValue([noteFixture]);
      mockGetNote.mockResolvedValue(noteFixture);

      render(<NotesWorkspace onOpenSettings={vi.fn()} />);

      await waitFor(() => {
        expect(mockListMyNotes).toHaveBeenCalledTimes(1);
      });
      // List rendered (note title visible) but editor body field not, since
      // no note has been selected yet on mobile.
      expect(screen.getByText(/phone note/i)).toBeTruthy();
      expect(mockGetNote).not.toHaveBeenCalled();
      expect(screen.queryByLabelText(/^body$/i)).toBeNull();
    });

    it("composes a new draft via the floating compose button", async () => {
      mockUseSession.mockReturnValue(makeSession());
      mockListMyNotes.mockResolvedValue([]);

      render(<NotesWorkspace onOpenSettings={vi.fn()} />);

      await waitFor(() => {
        expect(mockListMyNotes).toHaveBeenCalledTimes(1);
      });

      fireEvent.click(screen.getByRole("button", { name: /compose note/i }));
      expect(screen.getByRole("button", { name: /create note/i })).toBeTruthy();
      expect(
        (screen.getByLabelText(/^title$/i) as HTMLInputElement).value,
      ).toBe("");
      expect(
        (screen.getByLabelText(/^body$/i) as HTMLTextAreaElement).value,
      ).toBe("");
    });

    it("returns to the list when the back button is tapped", async () => {
      mockUseSession.mockReturnValue(makeSession());
      mockListMyNotes.mockResolvedValue([noteFixture]);
      mockGetNote.mockResolvedValue(noteFixture);

      render(<NotesWorkspace onOpenSettings={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/phone note/i)).toBeTruthy();
      });

      fireEvent.click(screen.getByText(/phone note/i));
      await waitFor(() => {
        expect(screen.getByLabelText(/^body$/i)).toBeTruthy();
      });

      fireEvent.click(screen.getByRole("button", { name: /back to notes/i }));
      // Editor body should no longer be rendered; list header stays.
      expect(screen.queryByLabelText(/^body$/i)).toBeNull();
      expect(screen.getByText(/my notes/i)).toBeTruthy();
    });

    it("blocks back navigation when discard is declined", async () => {
      mockUseSession.mockReturnValue(makeSession());
      mockListMyNotes.mockResolvedValue([noteFixture]);
      mockGetNote.mockResolvedValue(noteFixture);

      render(<NotesWorkspace onOpenSettings={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/phone note/i)).toBeTruthy();
      });

      fireEvent.click(screen.getByText(/phone note/i));
      const titleInput = await screen.findByLabelText(/^title$/i);
      fireEvent.change(titleInput, { target: { value: "Edited offline" } });

      // Decline the discard prompt -> selection persists, editor stays open.
      vi.spyOn(window, "confirm").mockReturnValueOnce(false);
      fireEvent.click(screen.getByRole("button", { name: /back to notes/i }));
      expect(screen.getByLabelText(/^body$/i)).toBeTruthy();
      expect(
        (screen.getByLabelText(/^title$/i) as HTMLInputElement).value,
      ).toBe("Edited offline");
    });

    it("deletes a note via the bottom 'Delete note' button", async () => {
      mockUseSession.mockReturnValue(makeSession());
      mockListMyNotes.mockResolvedValue([noteFixture]);
      mockGetNote.mockResolvedValue(noteFixture);
      mockDeleteNote.mockResolvedValue(undefined);

      render(<NotesWorkspace onOpenSettings={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/phone note/i)).toBeTruthy();
      });
      fireEvent.click(screen.getByText(/phone note/i));
      await waitFor(() => {
        expect(screen.getByLabelText(/^body$/i)).toBeTruthy();
      });

      fireEvent.click(screen.getByRole("button", { name: /delete note/i }));

      await waitFor(() => {
        expect(mockDeleteNote).toHaveBeenCalledWith(
          expect.objectContaining({ noteId: "note-mobile" }),
        );
      });
    });
  });
});
