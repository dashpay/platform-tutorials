// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CardArt } from "../src/components/CardArt";
import { buildArtRecipe, resolveArtTheme } from "../src/lib/cardArt";

afterEach(() => {
  cleanup();
});

describe("card art recipe", () => {
  it("maps starter-pack cards into stable visual themes", () => {
    expect(
      resolveArtTheme(
        "Fire Dragon",
        "A legendary beast from the volcanic plains",
      ),
    ).toBe("inferno");
    expect(
      resolveArtTheme(
        "Storm Falcon",
        "A sky hunter that rides the edges of thunderheads",
      ),
    ).toBe("storm");
    expect(
      resolveArtTheme(
        "Shadow Fox",
        "A swift trickster that strikes from darkness",
      ),
    ).toBe("shadow");
    expect(
      resolveArtTheme(
        "Crystal Serpent",
        "A glittering wyrm with scales sharp as glass",
      ),
    ).toBe("crystal");
  });

  it("falls back to neutral theme but keeps deterministic composition", () => {
    const first = buildArtRecipe({
      cardId: "card-xyz",
      rarity: "common",
      name: "Moss Archivist",
      description: "Collects old maps",
      attack: 4,
      defense: 6,
    });
    const second = buildArtRecipe({
      cardId: "card-xyz",
      rarity: "common",
      name: "Moss Archivist",
      description: "Collects old maps",
      attack: 4,
      defense: 6,
    });

    expect(first.theme).toBe("neutral");
    expect(second).toEqual(first);
  });
});

describe("CardArt", () => {
  it("renders themed art metadata on the wrapper", () => {
    const { container } = render(
      <CardArt
        cardId="card-1"
        rarity="legendary"
        name="Fire Dragon"
        description="A legendary beast from the volcanic plains"
        attack={9}
        defense={8}
      />,
    );

    const art = container.querySelector("[data-art-theme]");
    expect(art?.getAttribute("data-art-theme")).toBe("inferno");
    expect(art?.getAttribute("data-art-rarity")).toBe("legendary");
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
