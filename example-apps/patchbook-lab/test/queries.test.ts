// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

const { mockRefreshContractCache } = vi.hoisted(() => ({
  mockRefreshContractCache: vi.fn(),
}));

vi.mock("../src/dash/contract", () => ({
  refreshContractCache: mockRefreshContractCache,
}));

import { getNote, listMyNotes, normalizeNotes } from "../src/dash/queries";

afterEach(() => {
  mockRefreshContractCache.mockReset();
});

function makeSdk(result: unknown) {
  return {
    documents: {
      query: vi.fn().mockResolvedValue(result),
      get: vi.fn().mockResolvedValue(result),
    },
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

    expect(mockRefreshContractCache).toHaveBeenCalledWith({
      sdk,
      contractId: "contract-1",
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

    expect(mockRefreshContractCache).toHaveBeenCalledWith({
      sdk,
      contractId: "contract-1",
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
