import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listAllCards,
  listMarketplaceCards,
  listMyCards,
  normalizeCards,
} from "../src/dash/queries";
import type { DashSdk } from "../src/dash/types";

const rawCards = {
  "doc-1": {
    $ownerId: "owner-1",
    name: "Fire Dragon",
    description: "Hot",
    attack: 9,
    defense: 8,
    $price: 50n,
  },
  "doc-2": {
    $ownerId: "owner-2",
    name: "Aqua Spirit",
    attack: 3,
    defense: 4,
  },
  "doc-3": {
    $ownerId: "owner-3",
    name: "Unlisted Golem",
    attack: 4,
    defense: 9,
    $price: 0n,
  },
};

function makeSdk(results: unknown): DashSdk {
  return {
    documents: {
      query: vi.fn().mockResolvedValue(results),
    },
  } as unknown as DashSdk;
}

let log: ReturnType<typeof vi.fn>;

beforeEach(() => {
  log = vi.fn();
});

describe("card queries", () => {
  it("normalizes plain object query results keyed by document id", () => {
    expect(normalizeCards(rawCards)).toEqual([
      {
        id: "doc-1",
        ownerId: "owner-1",
        data: {
          name: "Fire Dragon",
          description: "Hot",
          attack: 9,
          defense: 8,
        },
        $price: 50n,
      },
      {
        id: "doc-2",
        ownerId: "owner-2",
        data: {
          name: "Aqua Spirit",
          description: undefined,
          attack: 3,
          defense: 4,
        },
        $price: undefined,
      },
      {
        id: "doc-3",
        ownerId: "owner-3",
        data: {
          name: "Unlisted Golem",
          description: undefined,
          attack: 4,
          defense: 9,
        },
        $price: 0n,
      },
    ]);
  });

  it("listMyCards queries the owner-scoped collection", async () => {
    const sdk = makeSdk(rawCards);

    const cards = await listMyCards({
      sdk,
      contractId: "contract-1",
      identityId: "owner-1",
      log,
    });

    expect(sdk.documents.query).toHaveBeenCalledWith({
      dataContractId: "contract-1",
      documentTypeName: "card",
      where: [["$ownerId", "==", "owner-1"]],
      limit: 100,
    });
    expect(cards).toHaveLength(3);
    expect(log).toHaveBeenCalledWith("Loading your cards…");
    expect(log).toHaveBeenCalledWith("Found 3 card(s).");
  });

  it("listAllCards uses the caller-provided limit", async () => {
    const sdk = makeSdk([]);

    await expect(
      listAllCards({
        sdk,
        contractId: "contract-1",
        limit: 25,
        log,
      }),
    ).resolves.toEqual([]);

    expect(sdk.documents.query).toHaveBeenCalledWith({
      dataContractId: "contract-1",
      documentTypeName: "card",
      limit: 25,
    });
    expect(log).toHaveBeenCalledWith("Loading all cards (any owner)…");
    expect(log).toHaveBeenCalledWith("Found 0 card(s) total.");
  });

  it("listMarketplaceCards returns only cards with a non-zero sale price", async () => {
    const sdk = makeSdk(rawCards);

    const cards = await listMarketplaceCards({
      sdk,
      contractId: "contract-1",
      log,
    });

    expect(sdk.documents.query).toHaveBeenCalledWith({
      dataContractId: "contract-1",
      documentTypeName: "card",
      limit: 100,
    });
    expect(cards.map((card) => card.id)).toEqual(["doc-1"]);
    expect(log).toHaveBeenCalledWith("Loading marketplace…");
    expect(log).toHaveBeenCalledWith("Found 1 card(s) for sale.");
  });
});
