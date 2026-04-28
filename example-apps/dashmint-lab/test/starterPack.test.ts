import { describe, expect, it } from "vitest";

import { drawStarterPack, STARTER_PACK_SIZE } from "../src/data/starterPack";

describe("starter pack data", () => {
  it("draws the expected deterministic pack with no duplicates", () => {
    const values = [0.99, 0.8, 0.6, 0.4, 0.2, 0.0, 0.0];
    const pack = drawStarterPack(() => values.shift() ?? 0);

    expect(pack).toHaveLength(STARTER_PACK_SIZE);
    expect(new Set(pack.map((card) => card.name)).size).toBe(STARTER_PACK_SIZE);
    expect(pack.map((card) => card.name)).toEqual([
      "Stone Golem",
      "Crystal Serpent",
      "Sun Priestess",
    ]);
  });

  it("produces different packs for different deterministic sequences", () => {
    const firstPack = drawStarterPack(() => 0);
    const secondValues = [0.99, 0.8, 0.6, 0.4, 0.2, 0.0, 0.0];
    const secondPack = drawStarterPack(() => secondValues.shift() ?? 0);

    expect(firstPack.map((card) => card.name)).not.toEqual(
      secondPack.map((card) => card.name),
    );
  });
});
