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
  localStorage.clear();
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
  it("shows the sign-in hero when the session is not authenticated", () => {
    mockUseSession.mockReturnValue(
      makeSession({
        status: "readonly",
        keyManager: null,
        identityId: null,
      }),
    );

    const onOpenLogin = vi.fn();
    render(
      <NotesWorkspace onOpenLogin={onOpenLogin} onOpenSettings={vi.fn()} />,
    );

    expect(
      screen.getByText(/personal notes, stored on a public blockchain/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/dashnote stores notes against your testnet identity/i),
    ).toBeTruthy();
    // The old EmptyState copy must not regress alongside the new hero.
    expect(screen.queryByText(/sign in to see your notes/i)).toBeNull();

    const loginButton = screen.getByRole("button", { name: /^sign in$/i });
    fireEvent.click(loginButton);
    expect(onOpenLogin).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /new note/i })).toBeNull();

    const sourceLink = screen.getByRole("link", { name: /view source/i });
    expect(sourceLink.getAttribute("href")).toBe(
      "https://github.com/dashpay/platform-tutorials/tree/main/example-apps/dashnote",
    );

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

    render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

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

    render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

    await waitFor(() => {
      expect(mockListMyNotes).toHaveBeenCalledTimes(1);
    });
    expect(screen.getAllByText(/no notes yet/i)[0]).toBeTruthy();
    expect(screen.getByText(/0 notes/i)).toBeTruthy();
  });

  it("in browsing mode, the desktop 'Sign in to create' button opens the login modal", async () => {
    mockUseSession.mockReturnValue(
      makeSession({
        status: "browsing",
        keyManager: null,
      }),
    );
    mockListMyNotes.mockResolvedValue([]);

    const onOpenLogin = vi.fn();
    render(
      <NotesWorkspace onOpenLogin={onOpenLogin} onOpenSettings={vi.fn()} />,
    );

    const desktopButton = await screen.findByRole("button", {
      name: /sign in to create/i,
    });
    fireEvent.click(desktopButton);
    expect(onOpenLogin).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /^new note$/i })).toBeNull();
  });

  it("in browsing mode, the mobile compose '+' button also opens the login modal", async () => {
    mockUseSession.mockReturnValue(
      makeSession({
        status: "browsing",
        keyManager: null,
      }),
    );
    mockListMyNotes.mockResolvedValue([]);

    const onOpenLogin = vi.fn();
    render(
      <NotesWorkspace onOpenLogin={onOpenLogin} onOpenSettings={vi.fn()} />,
    );

    const composeButton = await screen.findByRole("button", {
      name: /compose note/i,
    });
    fireEvent.click(composeButton);
    expect(onOpenLogin).toHaveBeenCalledTimes(1);
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
    mockUpdateNote.mockResolvedValue(3n);
    mockDeleteNote.mockResolvedValue(undefined);

    render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

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
    const confirmDialog = screen.getByRole("dialog");
    fireEvent.click(
      within(confirmDialog).getByRole("button", { name: /^delete$/i }),
    );
    await waitFor(() => {
      expect(mockDeleteNote).toHaveBeenCalledWith(
        expect.objectContaining({ noteId: "note-2" }),
      );
    });
  });

  it("merges fresh getNote data into the list and cache when the chain revision is newer than the cached list", async () => {
    mockUseSession.mockReturnValue(makeSession());
    const stale = {
      id: "note-3",
      ownerId: "identity-1",
      title: "Old title",
      message: "Old body preview",
      createdAt: 1000,
      updatedAt: 2000,
      revision: 1,
    };
    const fresh = {
      ...stale,
      title: "New title",
      message: "Fresh body preview",
      updatedAt: 3000,
      revision: 2,
    };
    // List query returns the stale revision (e.g. served from a peer that
    // hasn't caught up). getNote returns the newer revision.
    mockListMyNotes.mockResolvedValue([stale]);
    mockGetNote.mockResolvedValue(fresh);

    render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

    await waitFor(() => {
      expect(mockGetNote).toHaveBeenCalledWith(
        expect.objectContaining({ noteId: "note-3" }),
      );
    });

    // The editor body reflects the fresh fetch.
    await waitFor(() => {
      expect(
        (screen.getByLabelText(/^body$/i) as HTMLTextAreaElement).value,
      ).toBe("Fresh body preview");
    });

    // The list preview should also reflect the fresh content, not the stale
    // body returned by listMyNotes.
    await waitFor(() => {
      expect(screen.getAllByText(/fresh body preview/i).length).toBeGreaterThan(
        0,
      );
    });
    expect(screen.queryByText(/old body preview/i)).toBeNull();

    // The cache should hold the merged (fresh) revision so a cold reload
    // would paint the up-to-date content immediately.
    const cacheRaw = localStorage.getItem(
      "dashnote.notes.identity-1.contract-1.testnet",
    );
    expect(cacheRaw).toBeTruthy();
    const cached = JSON.parse(cacheRaw as string);
    expect(cached.notes).toHaveLength(1);
    expect(cached.notes[0].revision).toBe(2);
    expect(cached.notes[0].message).toBe("Fresh body preview");
  });

  describe("concurrent save handling", () => {
    const initial = {
      id: "note-conflict",
      ownerId: "identity-1",
      title: "Local title",
      message: "Local body",
      createdAt: 1000,
      updatedAt: 2000,
      revision: 1,
    };
    const remote = {
      ...initial,
      title: "Remote title",
      message: "Remote body",
      updatedAt: 3000,
      revision: 2,
    };

    it("surfaces a conflict warning when a failed save reveals the chain has moved", async () => {
      mockUseSession.mockReturnValue(makeSession());
      mockListMyNotes.mockResolvedValue([initial]);
      mockGetNote
        .mockResolvedValueOnce(initial) // initial detail load
        .mockResolvedValue(remote); // post-failure refresh — chain has moved
      mockUpdateNote.mockRejectedValue(new Error("Identity nonce is stale"));

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

      await waitFor(() => {
        expect(
          (screen.getByLabelText(/^body$/i) as HTMLTextAreaElement).value,
        ).toBe("Local body");
      });

      fireEvent.change(screen.getByLabelText(/^body$/i), {
        target: { value: "User edited body" },
      });
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

      // Conflict warning supersedes the raw nonce error — it's the actionable
      // signal that a retry would overwrite.
      await waitFor(() => {
        expect(
          screen.getByText(/this note changed on the network/i),
        ).toBeTruthy();
      });
      expect(screen.queryByText(/identity nonce is stale/i)).toBeNull();
      // User's typed input is preserved.
      expect(
        (screen.getByLabelText(/^body$/i) as HTMLTextAreaElement).value,
      ).toBe("User edited body");
    });

    it("does NOT show the conflict warning when a save fails but the chain revision is unchanged", async () => {
      mockUseSession.mockReturnValue(makeSession());
      mockListMyNotes.mockResolvedValue([initial]);
      // Both the initial detail load and the post-failure refresh return the
      // same revision — failure is unrelated to a concurrent edit.
      mockGetNote.mockResolvedValue(initial);
      mockUpdateNote.mockRejectedValue(new Error("Network unreachable"));

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

      await waitFor(() => {
        expect(
          (screen.getByLabelText(/^body$/i) as HTMLTextAreaElement).value,
        ).toBe("Local body");
      });

      fireEvent.change(screen.getByLabelText(/^body$/i), {
        target: { value: "User edited body" },
      });
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

      await waitFor(() => {
        expect(screen.getByText(/network unreachable/i)).toBeTruthy();
      });
      expect(
        screen.queryByText(/this note changed on the network/i),
      ).toBeNull();
    });

    it("retrying after a conflict overwrites the chain's newer revision", async () => {
      mockUseSession.mockReturnValue(makeSession());
      mockListMyNotes.mockResolvedValue([remote]);
      mockGetNote
        .mockResolvedValueOnce(initial) // initial detail load (rev=1)
        .mockResolvedValueOnce(remote) // post-failure refresh (rev=2)
        .mockResolvedValue(remote); // post-success reload
      mockUpdateNote
        .mockRejectedValueOnce(new Error("Identity nonce is stale"))
        .mockResolvedValue(3n);

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

      await waitFor(() => {
        expect(
          (screen.getByLabelText(/^body$/i) as HTMLTextAreaElement).value,
        ).toBe("Local body");
      });

      fireEvent.change(screen.getByLabelText(/^body$/i), {
        target: { value: "User wins" },
      });
      const saveButton = screen.getByRole("button", { name: /^save$/i });
      fireEvent.click(saveButton);

      // First click: warning surfaces.
      await waitFor(() => {
        expect(
          screen.getByText(/this note changed on the network/i),
        ).toBeTruthy();
      });

      // Retry — should overwrite.
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateNote).toHaveBeenCalledTimes(2);
      });
      expect(mockUpdateNote).toHaveBeenLastCalledWith(
        expect.objectContaining({
          noteId: "note-conflict",
          message: "User wins",
        }),
      );
    });

    it("does not flash the conflict warning during a normal successful save", async () => {
      mockUseSession.mockReturnValue(makeSession());
      const saved = {
        ...initial,
        message: "User edited body",
        revision: 2,
        updatedAt: 3000,
      };
      mockListMyNotes
        .mockResolvedValueOnce([initial])
        .mockResolvedValue([saved]);
      mockGetNote
        .mockResolvedValueOnce(initial) // initial detail load
        .mockResolvedValue(saved); // post-save reload
      mockUpdateNote.mockResolvedValue(2n);

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

      await waitFor(() => {
        expect(
          (screen.getByLabelText(/^body$/i) as HTMLTextAreaElement).value,
        ).toBe("Local body");
      });

      fireEvent.change(screen.getByLabelText(/^body$/i), {
        target: { value: "User edited body" },
      });
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

      // Wait for save to complete.
      await waitFor(() => {
        expect(mockUpdateNote).toHaveBeenCalledTimes(1);
      });
      // Wait for the post-save reload to settle (list query called twice:
      // once on mount, once after save).
      await waitFor(() => {
        expect(mockListMyNotes).toHaveBeenCalledTimes(2);
      });

      // Conflict warning must never have appeared.
      expect(
        screen.queryByText(/this note changed on the network/i),
      ).toBeNull();
    });
  });

  it("surfaces query failures as a regular editor error", async () => {
    mockUseSession.mockReturnValue(makeSession());
    mockListMyNotes.mockRejectedValue(new Error("Data contract not found"));

    render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/editor error/i)).toBeTruthy();
    });
    expect(screen.getByText("Data contract not found")).toBeTruthy();
  });

  it("shows the no-contract empty state when authed without a contract", () => {
    mockUseSession.mockReturnValue(makeSession({ contractId: null }));
    const onOpenSettings = vi.fn();

    render(
      <NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={onOpenSettings} />,
    );

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

    render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

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

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/phone note/i)).toBeTruthy();
      });
      // List rendered (note title visible) but editor body field not, since
      // no note has been selected yet on mobile.
      expect(mockListMyNotes).toHaveBeenCalledTimes(1);
      expect(mockGetNote).not.toHaveBeenCalled();
      expect(screen.queryByLabelText(/^body$/i)).toBeNull();
    });

    it("composes a new draft via the floating compose button", async () => {
      mockUseSession.mockReturnValue(makeSession());
      mockListMyNotes.mockResolvedValue([]);

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

      await waitFor(() => {
        expect(mockListMyNotes).toHaveBeenCalledTimes(1);
      });

      fireEvent.click(screen.getByRole("button", { name: /compose note/i }));
      expect(screen.queryByRole("button", { name: /create note/i })).toBeNull();
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

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

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
      expect(screen.getByPlaceholderText(/search/i)).toBeTruthy();
    });

    it("blocks back navigation when discard is declined", async () => {
      mockUseSession.mockReturnValue(makeSession());
      mockListMyNotes.mockResolvedValue([noteFixture]);
      mockGetNote.mockResolvedValue(noteFixture);

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

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

    it("deletes a note via mobile note actions after confirming the modal", async () => {
      mockUseSession.mockReturnValue(makeSession());
      mockListMyNotes.mockResolvedValue([noteFixture]);
      mockGetNote.mockResolvedValue(noteFixture);
      mockDeleteNote.mockResolvedValue(undefined);

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/phone note/i)).toBeTruthy();
      });
      fireEvent.click(screen.getByText(/phone note/i));
      await waitFor(() => {
        expect(screen.getByLabelText(/^body$/i)).toBeTruthy();
      });

      fireEvent.click(screen.getByRole("button", { name: /note actions/i }));
      const sheet = screen.getByRole("dialog", { name: /note actions/i });
      fireEvent.click(within(sheet).getByRole("button", { name: /^delete$/i }));

      // Trigger doesn't fire the delete directly anymore — the
      // confirmation modal must be acknowledged first.
      expect(mockDeleteNote).not.toHaveBeenCalled();
      const dialog = screen.getByRole("dialog", { name: /delete note/i });
      fireEvent.click(
        within(dialog).getByRole("button", { name: /^delete$/i }),
      );

      await waitFor(() => {
        expect(mockDeleteNote).toHaveBeenCalledWith(
          expect.objectContaining({ noteId: "note-mobile" }),
        );
      });
    });

    it("opens the delete modal from list actions without opening the note", async () => {
      mockUseSession.mockReturnValue(makeSession());
      mockListMyNotes.mockResolvedValue([noteFixture]);
      mockGetNote.mockResolvedValue(noteFixture);
      mockDeleteNote.mockResolvedValue(undefined);

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/phone note/i)).toBeTruthy();
      });

      fireEvent.click(
        screen.getByRole("button", { name: /actions for phone note/i }),
      );
      const sheet = screen.getByRole("dialog", { name: /note actions/i });
      fireEvent.click(within(sheet).getByRole("button", { name: /^delete$/i }));

      expect(screen.queryByLabelText(/^body$/i)).toBeNull();
      expect(mockGetNote).not.toHaveBeenCalled();

      const dialog = screen.getByRole("dialog", { name: /delete note/i });
      fireEvent.click(
        within(dialog).getByRole("button", { name: /^delete$/i }),
      );

      await waitFor(() => {
        expect(mockDeleteNote).toHaveBeenCalledWith(
          expect.objectContaining({ noteId: "note-mobile" }),
        );
      });
    });
  });

  describe("cache hydration & revalidation", () => {
    function seedCache(notes: unknown[], identityId = "identity-1") {
      localStorage.setItem(
        `dashnote.notes.${identityId}.contract-1.testnet`,
        JSON.stringify({
          version: 1,
          identityId,
          contractId: "contract-1",
          network: "testnet",
          cachedAt: Date.now(),
          notes,
        }),
      );
    }

    it("paints cached notes immediately, before the network revalidation resolves", async () => {
      mockUseSession.mockReturnValue(makeSession());
      seedCache([
        {
          id: "cached-1",
          ownerId: "identity-1",
          title: "Cached title",
          message: "Cached body",
          createdAt: 1000,
          updatedAt: 2000,
          revision: 1,
        },
      ]);
      // listMyNotes never resolves during this test — we only assert that the
      // cached content is visible synchronously.
      let resolveList: (value: unknown[]) => void = () => {};
      mockListMyNotes.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveList = resolve;
          }),
      );
      mockGetNote.mockImplementation(() => new Promise(() => {}));

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

      // Synchronously visible from cache (no waitFor needed).
      expect(screen.getAllByText(/cached title/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/1 note/i)).toBeTruthy();
      // Refreshing indicator should also be visible while revalidating.
      expect(screen.getByLabelText(/refreshing notes/i)).toBeTruthy();

      // Clean up: let the pending promise resolve so cleanup() doesn't hang.
      resolveList([]);
    });

    it("disables save while revalidating cached data, then enables it after the chain confirms", async () => {
      mockUseSession.mockReturnValue(makeSession());
      const cached = {
        id: "cached-2",
        ownerId: "identity-1",
        title: "Cached",
        message: "Cached body",
        createdAt: 1000,
        updatedAt: 2000,
        revision: 1,
      };
      seedCache([cached]);

      let resolveList: (value: unknown[]) => void = () => {};
      mockListMyNotes.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveList = resolve;
          }),
      );
      mockGetNote.mockResolvedValue(cached);

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

      // Cached note is auto-selected on desktop and the editor is shown, but
      // the save button must be disabled because editsReady=false.
      await waitFor(() => {
        expect(screen.getByLabelText(/^body$/i)).toBeTruthy();
      });

      // Make the editor dirty so dirty-gating doesn't mask the editsReady gate.
      fireEvent.change(screen.getByLabelText(/^body$/i), {
        target: { value: "edited body" },
      });
      const saveButton = screen.getByRole("button", { name: /^save$/i });
      expect(saveButton.hasAttribute("disabled")).toBe(true);

      // Resolve the chain query — editsReady flips true and save becomes
      // enabled (dirty + canMutate + editsReady all satisfied).
      resolveList([cached]);
      await waitFor(() => {
        expect(saveButton.hasAttribute("disabled")).toBe(false);
      });
    });

    it("warns the user instead of clobbering when the chain revision moves while editing", async () => {
      mockUseSession.mockReturnValue(makeSession());
      const initial = {
        id: "note-conflict",
        ownerId: "identity-1",
        title: "Original",
        message: "Original body",
        createdAt: 1000,
        updatedAt: 2000,
        revision: 1,
      };
      const newerFromChain = {
        ...initial,
        title: "Network edit",
        message: "Network body",
        updatedAt: 3000,
        revision: 2,
      };
      // First listMyNotes returns rev 1; second (triggered by post-edit
      // background revalidation) returns rev 2.
      mockListMyNotes
        .mockResolvedValueOnce([initial])
        .mockResolvedValueOnce([newerFromChain]);
      mockGetNote.mockResolvedValue(initial);

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

      // Wait for initial load to settle so the editor reflects the cached/
      // chain content with baselines set.
      await waitFor(() => {
        expect(
          (screen.getByLabelText(/^body$/i) as HTMLTextAreaElement).value,
        ).toBe("Original body");
      });

      // User starts editing — dirty=true, baseline still tracks "Original".
      fireEvent.change(screen.getByLabelText(/^body$/i), {
        target: { value: "User local edit" },
      });

      // Trigger background revalidation: ensure the document is "visible",
      // step Date.now past the focus throttle, and dispatch visibilitychange.
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => false,
      });
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
      document.dispatchEvent(new Event("visibilitychange"));

      await waitFor(() => {
        expect(mockListMyNotes).toHaveBeenCalledTimes(2);
      });

      // Conflict warning should surface; user's edit should remain.
      await waitFor(() => {
        expect(
          screen.getByText(/this note changed on the network/i),
        ).toBeTruthy();
      });
      expect(
        (screen.getByLabelText(/^body$/i) as HTMLTextAreaElement).value,
      ).toBe("User local edit");
    });

    it("keeps cached notes visible during a remembered-identity rehydrate when the SDK is still connecting", async () => {
      // Simulates the page-load path where SessionContext has identityId +
      // browsing status from synchronously-loaded localStorage but the SDK
      // hasn't connected yet. reloadNotes must NOT wipe the cached list while
      // we wait for sdk to land.
      mockUseSession.mockReturnValue(
        makeSession({
          status: "browsing",
          sdk: null,
          keyManager: null,
        }),
      );
      seedCache([
        {
          id: "cached-rehydrate",
          ownerId: "identity-1",
          title: "Survives rehydrate",
          message: "Body",
          createdAt: 1000,
          updatedAt: 2000,
          revision: 1,
        },
      ]);

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

      // Cached list paints synchronously, even though sdk is null. Without the
      // reloadNotes-skip-when-sdk-null fix, the list would be wiped to [].
      expect(screen.getByText("Survives rehydrate")).toBeTruthy();
      expect(screen.getByText(/1 note/i)).toBeTruthy();
      // listMyNotes must not have been invoked yet — sdk is still connecting.
      expect(mockListMyNotes).not.toHaveBeenCalled();
    });

    it("seeds the editor pane from the first cached note on desktop so 'No note selected' never paints", () => {
      mockUseSession.mockReturnValue(makeSession());
      seedCache([
        {
          id: "cached-seed",
          ownerId: "identity-1",
          title: "Seeded title",
          message: "Seeded body",
          createdAt: 1000,
          updatedAt: 2000,
          revision: 1,
        },
      ]);
      mockListMyNotes.mockImplementation(() => new Promise(() => {}));
      mockGetNote.mockImplementation(() => new Promise(() => {}));

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

      // Editor pane shows the seeded note's content from the very first paint
      // (no "No note selected" empty state in between).
      expect(screen.queryByText(/no note selected/i)).toBeNull();
      // Both title (input) and body (textarea) reflect the cached values from
      // frame 1 — proves the synchronous editor seed.
      expect(screen.getByDisplayValue("Seeded title")).toBeTruthy();
      expect(screen.getByDisplayValue("Seeded body")).toBeTruthy();
    });

    it("does not auto-select the editor on mobile (mobile lands on the list view)", () => {
      stubMatchMedia(false);
      mockUseSession.mockReturnValue(makeSession());
      seedCache([
        {
          id: "cached-mobile",
          ownerId: "identity-1",
          title: "Mobile cached",
          message: "Mobile body",
          createdAt: 1000,
          updatedAt: 2000,
          revision: 1,
        },
      ]);
      mockListMyNotes.mockImplementation(() => new Promise(() => {}));

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

      // Cached list paints synchronously on mobile too.
      expect(screen.getByText("Mobile cached")).toBeTruthy();
      // Editor pane is in the DOM but in its "No note selected" state — the
      // mobile gate is selectedId === null, so seeding must NOT have run.
      expect(screen.getByText(/no note selected/i)).toBeTruthy();
      // And neither editor input is populated, since selectedNote is null.
      expect(screen.queryByDisplayValue("Mobile cached")).toBeNull();
      expect(screen.queryByDisplayValue("Mobile body")).toBeNull();
    });

    it("ignores a late listMyNotes response from a previous identity/contract", async () => {
      // Scenario: workspace is mounted for identity-1 + contract-1, and
      // listMyNotes is in flight. Before it resolves, the user switches to
      // identity-2 + contract-2 (re-render with a new session). The first
      // request finally resolves with notes for the *previous* session — it
      // must be ignored, both for state (no stale notes painted) and for
      // cache writes (no notes saved under the previous identity/contract).
      mockUseSession.mockReturnValue(makeSession());

      // First call: hold open so we can resolve it after the switch.
      let resolveFirst: (value: unknown[]) => void = () => {};
      // Second call: also hold open so we can assert against the *old*
      // response specifically without the new one painting first.
      let resolveSecond: (value: unknown[]) => void = () => {};
      mockListMyNotes
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveSecond = resolve;
            }),
        );
      mockGetNote.mockImplementation(() => new Promise(() => {}));

      const { rerender } = render(
        <NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />,
      );

      // Switch to a new identity+contract while the first listMyNotes is
      // still pending. Re-rendering with a fresh session value triggers the
      // hydrate effect, which kicks off a new reloadNotes (and bumps the
      // reload token).
      mockUseSession.mockReturnValue(
        makeSession({ identityId: "identity-2", contractId: "contract-2" }),
      );
      rerender(
        <NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />,
      );

      // Wait until the post-rerender hydrate effect has actually issued its
      // own listMyNotes call. This proves the new reload token is in place
      // before we resolve the stale request — otherwise the test could pass
      // by microtask-timing accident rather than by the guard's logic.
      await waitFor(() => {
        expect(mockListMyNotes).toHaveBeenCalledTimes(2);
      });

      // Now resolve the *stale* first request with notes that belong to the
      // previous session. The guard inside reloadNotes should drop them.
      const staleNote = {
        id: "stale-1",
        ownerId: "identity-1",
        title: "Stale title from old session",
        message: "should not appear",
        createdAt: 1000,
        updatedAt: 2000,
        revision: 1,
      };
      resolveFirst([staleNote]);

      // Poll the invariant directly — `waitFor` retries until microtasks
      // queued by resolveFirst() have settled. If the guard is missing,
      // this fails (cache write happens synchronously in the await
      // continuation); if it's working, the cache stays null.
      await waitFor(() => {
        expect(
          localStorage.getItem("dashnote.notes.identity-1.contract-1.testnet"),
        ).toBeNull();
      });
      expect(screen.queryByText(/stale title from old session/i)).toBeNull();
      expect(
        localStorage.getItem("dashnote.notes.identity-2.contract-2.testnet"),
      ).toBeNull();

      // Clean up: let the second pending promise resolve so cleanup() doesn't hang.
      resolveSecond([]);
    });

    it("keeps cached notes visible when the network revalidation fails", async () => {
      mockUseSession.mockReturnValue(makeSession());
      seedCache([
        {
          id: "cached-3",
          ownerId: "identity-1",
          title: "Cached only",
          message: "Cached body",
          createdAt: 1000,
          updatedAt: 2000,
          revision: 1,
        },
      ]);
      mockListMyNotes.mockRejectedValue(new Error("Network unreachable"));
      mockGetNote.mockRejectedValue(new Error("Network unreachable"));

      render(<NotesWorkspace onOpenLogin={vi.fn()} onOpenSettings={vi.fn()} />);

      // Error surfaces but cached data stays visible.
      await waitFor(() => {
        expect(screen.getByText(/network unreachable/i)).toBeTruthy();
      });
      expect(screen.getAllByText(/cached only/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/1 note/i)).toBeTruthy();
    });
  });
});
