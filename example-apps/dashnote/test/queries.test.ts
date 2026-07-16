// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import {
  getNote,
  listMyNotes,
  listMyNotesPage,
  normalizeNotes,
} from "../src/dash/queries";

function makeSdk(result: unknown) {
  return {
    documents: {
      query: vi.fn().mockResolvedValue(result),
      get: vi.fn().mockResolvedValue(result),
    },
  };
}

function makePagedSdk(...results: unknown[]) {
  const sdk = makeSdk(undefined);
  for (const result of results) {
    sdk.documents.query.mockResolvedValueOnce(result);
  }
  return sdk;
}

function noteDocument(updatedAt: number) {
  return {
    $ownerId: "owner-1",
    $createdAt: updatedAt,
    $updatedAt: updatedAt,
    title: `Note ${updatedAt}`,
    message: "Body",
    $revision: 0,
  };
}

describe("normalizeNotes", () => {
  it("normalizes arrays, maps, and revision values", () => {
    const notes = normalizeNotes(
      new Map([
        [
          "note-1",
          {
            $ownerId: "owner-1",
            $createdAt: "1000",
            $updatedAt: 2000n,
            $revision: "4",
            title: "Title",
            message: "Body",
          },
        ],
      ]),
    );

    expect(notes).toEqual([
      {
        id: "note-1",
        ownerId: "owner-1",
        title: "Title",
        message: "Body",
        createdAt: 1000,
        updatedAt: 2000,
        revision: 4,
      },
    ]);
  });
});

describe("listMyNotes", () => {
  it("queries by owner and returns notes sorted newest-first by updatedAt", async () => {
    const sdk = makeSdk([
      {
        $id: "note-old",
        $ownerId: "owner-1",
        $createdAt: 1000,
        $updatedAt: 1000,
        title: "Old",
        message: "First",
        $revision: 0,
      },
      {
        $id: "note-new",
        $ownerId: "owner-1",
        $createdAt: 2000,
        $updatedAt: 5000,
        title: "New",
        message: "Second",
        $revision: 2,
      },
    ]);

    const notes = await listMyNotes({
      sdk: sdk as never,
      contractId: "contract-1",
      ownerId: "owner-1",
    });

    expect(sdk.documents.query).toHaveBeenCalledWith({
      dataContractId: "contract-1",
      documentTypeName: "note",
      where: [["$ownerId", "==", "owner-1"]],
      orderBy: [
        ["$ownerId", "asc"],
        ["$updatedAt", "asc"],
      ],
      limit: 100,
    });
    expect(notes.map((note) => note.id)).toEqual(["note-new", "note-old"]);
  });

  it("uses the last server-ordered ID as the exclusive next-page cursor", async () => {
    const sdk = makeSdk(
      new Map([
        ["note-new", noteDocument(5000)],
        ["note-old", noteDocument(1000)],
      ]),
    );

    const page = await listMyNotesPage({
      sdk: sdk as never,
      contractId: "contract-1",
      ownerId: "owner-1",
      limit: 2,
    });

    expect(page.notes.map((note) => note.id)).toEqual(["note-new", "note-old"]);
    expect(page.nextCursor).toBe("note-old");
  });

  it("walks first, next, and final pages without skipping the boundary", async () => {
    const sdk = makePagedSdk(
      new Map([
        ["note-old", noteDocument(1000)],
        ["note-middle", noteDocument(2000)],
      ]),
      new Map([["note-new", noteDocument(3000)]]),
    );

    const notes = await listMyNotes({
      sdk: sdk as never,
      contractId: "contract-1",
      ownerId: "owner-1",
      limit: 2,
    });

    expect(sdk.documents.query).toHaveBeenNthCalledWith(1, {
      dataContractId: "contract-1",
      documentTypeName: "note",
      where: [["$ownerId", "==", "owner-1"]],
      orderBy: [
        ["$ownerId", "asc"],
        ["$updatedAt", "asc"],
      ],
      limit: 2,
    });
    expect(sdk.documents.query).toHaveBeenNthCalledWith(2, {
      dataContractId: "contract-1",
      documentTypeName: "note",
      where: [["$ownerId", "==", "owner-1"]],
      orderBy: [
        ["$ownerId", "asc"],
        ["$updatedAt", "asc"],
      ],
      limit: 2,
      startAfter: "note-middle",
    });
    expect(notes.map((note) => note.id)).toEqual([
      "note-new",
      "note-middle",
      "note-old",
    ]);
  });

  it("queries once more when the final populated page is exactly full", async () => {
    const sdk = makePagedSdk(
      new Map([
        ["note-old", noteDocument(1000)],
        ["note-new", noteDocument(2000)],
      ]),
      new Map(),
    );

    const notes = await listMyNotes({
      sdk: sdk as never,
      contractId: "contract-1",
      ownerId: "owner-1",
      limit: 2,
    });

    expect(sdk.documents.query).toHaveBeenCalledTimes(2);
    expect(sdk.documents.query).toHaveBeenLastCalledWith(
      expect.objectContaining({ startAfter: "note-new" }),
    );
    expect(notes.map((note) => note.id)).toEqual(["note-new", "note-old"]);
  });

  it("rejects a page that repeats the exclusive cursor", async () => {
    const sdk = makeSdk(
      new Map([
        ["note-old", noteDocument(1000)],
        ["note-cursor", noteDocument(2000)],
      ]),
    );

    await expect(
      listMyNotesPage({
        sdk: sdk as never,
        contractId: "contract-1",
        ownerId: "owner-1",
        startAfter: "note-cursor",
        limit: 2,
      }),
    ).rejects.toThrow("Document pagination made no progress.");
  });

  it("rejects page sizes outside the SDK's 1 to 100 range", async () => {
    const sdk = makeSdk(new Map());

    await expect(
      listMyNotesPage({
        sdk: sdk as never,
        contractId: "contract-1",
        ownerId: "owner-1",
        limit: 0,
      }),
    ).rejects.toThrow("Note page size must be an integer from 1 to 100.");
    expect(sdk.documents.query).not.toHaveBeenCalled();
  });
});

describe("getNote", () => {
  it("normalizes a single note document", async () => {
    const sdk = makeSdk({
      toJSON() {
        return {
          $ownerId: "owner-1",
          $createdAt: 1000,
          $updatedAt: 3000,
          title: null,
          message: "Hello",
        };
      },
      revision: 7n,
    });

    const note = await getNote({
      sdk: sdk as never,
      contractId: "contract-1",
      noteId: "note-7",
    });

    expect(sdk.documents.get).toHaveBeenCalledWith(
      "contract-1",
      "note",
      "note-7",
    );
    expect(note).toEqual({
      id: "note-7",
      ownerId: "owner-1",
      title: null,
      message: "Hello",
      createdAt: 1000,
      updatedAt: 3000,
      revision: 7,
    });
  });
});
