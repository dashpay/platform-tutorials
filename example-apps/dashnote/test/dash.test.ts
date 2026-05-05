// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

const { mockDocumentConstructor } = vi.hoisted(() => ({
  mockDocumentConstructor: vi.fn(),
}));

vi.mock("@dashevo/evo-sdk", () => ({
  Document: function MockDocument(args: unknown) {
    mockDocumentConstructor(args);
    return {
      args,
      toJSON: () => ({ $id: "note-1" }),
    };
  },
}));

import { createNote } from "../src/dash/createNote";
import { deleteNote } from "../src/dash/deleteNote";
import { updateNote } from "../src/dash/updateNote";

function makeKeyManager() {
  return {
    getAuth: vi.fn().mockResolvedValue({
      identity: { id: "identity-1" },
      identityKey: "identity-key",
      signer: "signer",
    }),
  };
}

describe("createNote", () => {
  it("creates a note with a trimmed title", async () => {
    const sdk = {
      documents: {
        create: vi.fn().mockResolvedValue(undefined),
      },
    };

    const noteId = await createNote({
      sdk: sdk as never,
      keyManager: makeKeyManager() as never,
      contractId: "contract-1",
      title: "  Hello  ",
      message: "Body",
    });

    expect(noteId).toBe("note-1");
    expect(mockDocumentConstructor).toHaveBeenCalledWith({
      properties: {
        title: "Hello",
        message: "Body",
      },
      documentTypeName: "note",
      dataContractId: "contract-1",
      ownerId: "identity-1",
    });
  });

  it("omits a blank title for body-only notes", async () => {
    mockDocumentConstructor.mockReset();
    const sdk = {
      documents: {
        create: vi.fn().mockResolvedValue(undefined),
      },
    };

    await createNote({
      sdk: sdk as never,
      keyManager: makeKeyManager() as never,
      contractId: "contract-1",
      title: "   ",
      message: "Body only",
    });

    expect(mockDocumentConstructor).toHaveBeenCalledWith({
      properties: {
        message: "Body only",
      },
      documentTypeName: "note",
      dataContractId: "contract-1",
      ownerId: "identity-1",
    });
  });
});

describe("updateNote", () => {
  it("fetches the current note and increments revision before replace", async () => {
    mockDocumentConstructor.mockReset();
    const sdk = {
      documents: {
        get: vi.fn().mockResolvedValue({ revision: 4n }),
        replace: vi.fn().mockResolvedValue(undefined),
      },
    };

    await updateNote({
      sdk: sdk as never,
      keyManager: makeKeyManager() as never,
      contractId: "contract-1",
      noteId: "note-9",
      title: "",
      message: "Updated body",
    });

    expect(sdk.documents.get).toHaveBeenCalledWith(
      "contract-1",
      "note",
      "note-9",
    );
    expect(mockDocumentConstructor).toHaveBeenCalledWith({
      properties: {
        message: "Updated body",
      },
      documentTypeName: "note",
      dataContractId: "contract-1",
      ownerId: "identity-1",
      revision: 5n,
      id: "note-9",
    });
  });
});

describe("deleteNote", () => {
  it("passes the note identity fields to sdk.documents.delete", async () => {
    const sdk = {
      documents: {
        delete: vi.fn().mockResolvedValue(undefined),
      },
    };

    await deleteNote({
      sdk: sdk as never,
      keyManager: makeKeyManager() as never,
      contractId: "contract-1",
      noteId: "note-3",
    });

    expect(sdk.documents.delete).toHaveBeenCalledWith({
      document: {
        id: "note-3",
        ownerId: "identity-1",
        dataContractId: "contract-1",
        documentTypeName: "note",
      },
      identityKey: "identity-key",
      signer: "signer",
    });
  });
});
