import type { MintCardInput } from "../dash/mintCard";

export const STARTER_PACK_SIZE = 3;

export const STARTER_CARD_POOL: ReadonlyArray<Readonly<MintCardInput>> = [
  {
    name: "Fire Dragon",
    description: "A legendary beast from the volcanic plains",
  },
  {
    name: "Stone Golem",
    description: "An ancient guardian carved from living rock",
  },
  {
    name: "Shadow Fox",
    description: "A swift trickster that strikes from darkness",
  },
  {
    name: "Storm Falcon",
    description: "A sky hunter that rides the edges of thunderheads",
  },
  {
    name: "Crystal Serpent",
    description: "A glittering wyrm with scales sharp as glass",
  },
  {
    name: "Iron Mammoth",
    description: "A plated titan that tramples through siege lines",
  },
  {
    name: "Sun Priestess",
    description: "A radiant caster who shields allies with solar fire",
  },
  {
    name: "Frost Warden",
    description: "A patient sentinel that freezes intruders in place",
  },
];

function shuffleCards<T>(cards: readonly T[], random: () => number): T[] {
  // Keep this Fisher-Yates variant stable unless the deterministic test
  // expectations are updated alongside it.
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function drawStarterPack(
  random: () => number = Math.random,
): MintCardInput[] {
  return shuffleCards(STARTER_CARD_POOL, random).slice(0, STARTER_PACK_SIZE);
}
