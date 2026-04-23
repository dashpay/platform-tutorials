import type { Rarity } from "./rarity";

/**
 * Presentation-only helper for deterministic card visuals.
 *
 * Learners focused on Dash Platform flows can ignore this file entirely:
 * it does not affect contracts, documents, identity ownership, or mutations.
 */
export type ArtTheme =
  | "inferno"
  | "storm"
  | "frost"
  | "shadow"
  | "earth"
  | "crystal"
  | "solar"
  | "neutral";

export interface CardArtInput {
  cardId: string;
  rarity: Rarity;
  name?: string | null;
  description?: string | null;
  attack?: number;
  defense?: number;
}

export interface ArtPalette {
  bgTop: string;
  bgBottom: string;
  glow: string;
  accent: string;
  accentSoft: string;
  terrain: string;
  shadow: string;
  rim: string;
}

export interface ArtRecipe {
  seed: number;
  theme: ArtTheme;
  rarity: Rarity;
  palette: ArtPalette;
  attackBias: number;
  defenseBias: number;
  balance: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  terrainLift: number;
  subjectScale: number;
  fxCount: number;
  slashCount: number;
  glowOpacity: number;
  shieldOpacity: number;
  highlightOpacity: number;
}

const THEME_RULES: ReadonlyArray<{
  theme: ArtTheme;
  keywords: readonly string[];
}> = [
  { theme: "inferno", keywords: ["fire", "dragon", "flame", "volcanic"] },
  { theme: "storm", keywords: ["storm", "thunder", "sky", "falcon", "lightning"] },
  { theme: "frost", keywords: ["frost", "ice", "warden", "freeze"] },
  { theme: "shadow", keywords: ["shadow", "dark", "night", "fox"] },
  { theme: "earth", keywords: ["stone", "iron", "golem", "mammoth", "rock"] },
  { theme: "crystal", keywords: ["crystal", "serpent", "glass", "wyrm"] },
  { theme: "solar", keywords: ["sun", "solar", "priestess", "radiant"] },
];

const PALETTES: Record<ArtTheme, ArtPalette> = {
  inferno: {
    bgTop: "oklch(34% 0.16 28)",
    bgBottom: "oklch(22% 0.07 18)",
    glow: "oklch(86% 0.18 78)",
    accent: "oklch(74% 0.19 48)",
    accentSoft: "oklch(65% 0.12 30)",
    terrain: "oklch(30% 0.09 20)",
    shadow: "oklch(19% 0.04 18)",
    rim: "oklch(82% 0.14 75)",
  },
  storm: {
    bgTop: "oklch(36% 0.12 244)",
    bgBottom: "oklch(20% 0.05 260)",
    glow: "oklch(83% 0.11 215)",
    accent: "oklch(77% 0.15 226)",
    accentSoft: "oklch(62% 0.09 245)",
    terrain: "oklch(25% 0.04 255)",
    shadow: "oklch(18% 0.03 260)",
    rim: "oklch(84% 0.12 215)",
  },
  frost: {
    bgTop: "oklch(38% 0.08 224)",
    bgBottom: "oklch(23% 0.03 235)",
    glow: "oklch(90% 0.08 205)",
    accent: "oklch(82% 0.1 210)",
    accentSoft: "oklch(68% 0.06 220)",
    terrain: "oklch(28% 0.03 225)",
    shadow: "oklch(18% 0.02 235)",
    rim: "oklch(92% 0.05 205)",
  },
  shadow: {
    bgTop: "oklch(26% 0.04 280)",
    bgBottom: "oklch(15% 0.02 250)",
    glow: "oklch(70% 0.08 210)",
    accent: "oklch(60% 0.12 300)",
    accentSoft: "oklch(52% 0.06 260)",
    terrain: "oklch(20% 0.03 265)",
    shadow: "oklch(12% 0.02 250)",
    rim: "oklch(76% 0.06 210)",
  },
  earth: {
    bgTop: "oklch(36% 0.07 75)",
    bgBottom: "oklch(21% 0.03 60)",
    glow: "oklch(82% 0.09 82)",
    accent: "oklch(72% 0.11 78)",
    accentSoft: "oklch(56% 0.06 62)",
    terrain: "oklch(27% 0.04 62)",
    shadow: "oklch(16% 0.02 55)",
    rim: "oklch(80% 0.07 85)",
  },
  crystal: {
    bgTop: "oklch(37% 0.1 190)",
    bgBottom: "oklch(20% 0.04 255)",
    glow: "oklch(88% 0.09 180)",
    accent: "oklch(78% 0.12 185)",
    accentSoft: "oklch(68% 0.08 250)",
    terrain: "oklch(26% 0.05 220)",
    shadow: "oklch(16% 0.03 240)",
    rim: "oklch(90% 0.06 180)",
  },
  solar: {
    bgTop: "oklch(45% 0.11 95)",
    bgBottom: "oklch(24% 0.04 58)",
    glow: "oklch(94% 0.09 98)",
    accent: "oklch(86% 0.11 92)",
    accentSoft: "oklch(74% 0.08 74)",
    terrain: "oklch(31% 0.05 70)",
    shadow: "oklch(18% 0.03 62)",
    rim: "oklch(95% 0.06 102)",
  },
  neutral: {
    bgTop: "oklch(31% 0.04 250)",
    bgBottom: "oklch(18% 0.02 250)",
    glow: "oklch(86% 0.03 220)",
    accent: "oklch(75% 0.05 220)",
    accentSoft: "oklch(62% 0.03 230)",
    terrain: "oklch(25% 0.02 245)",
    shadow: "oklch(15% 0.02 250)",
    rim: "oklch(84% 0.02 215)",
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

export function resolveArtTheme(
  name?: string | null,
  description?: string | null,
): ArtTheme {
  const tokens = new Set([
    ...tokenize(name ?? ""),
    ...tokenize(description ?? ""),
  ]);

  for (const rule of THEME_RULES) {
    if (rule.keywords.some((keyword) => tokens.has(keyword))) {
      return rule.theme;
    }
  }

  return "neutral";
}

export function buildArtRecipe(input: CardArtInput): ArtRecipe {
  const theme = resolveArtTheme(input.name, input.description);
  const seed = hashString(
    [
      input.cardId,
      input.name ?? "",
      input.description ?? "",
      input.attack ?? 0,
      input.defense ?? 0,
      theme,
    ].join("|"),
  );
  const random = mulberry32(seed);
  const attackBias = clamp((input.attack ?? 0) / 10, 0, 1);
  const defenseBias = clamp((input.defense ?? 0) / 10, 0, 1);
  const balance = 1 - Math.min(1, Math.abs(attackBias - defenseBias));
  const rarityBoost =
    input.rarity === "legendary" ? 0.18 : input.rarity === "rare" ? 0.1 : 0;

  return {
    seed,
    theme,
    rarity: input.rarity,
    palette: PALETTES[theme],
    attackBias,
    defenseBias,
    balance,
    rotation:
      (attackBias - defenseBias) * 14 + (random() * 2 - 1) * 7,
    offsetX: (random() * 2 - 1) * 8,
    offsetY: (random() * 2 - 1) * 6,
    terrainLift: 82 - attackBias * 10 + defenseBias * 6,
    subjectScale: 1 + rarityBoost * 0.4 + balance * 0.04,
    fxCount: input.rarity === "legendary" ? 8 : input.rarity === "rare" ? 6 : 4,
    slashCount: 2 + Math.round(attackBias * 3) + (input.rarity === "legendary" ? 1 : 0),
    glowOpacity:
      input.rarity === "legendary" ? 0.42 : input.rarity === "rare" ? 0.3 : 0.18,
    shieldOpacity: 0.12 + defenseBias * 0.24,
    highlightOpacity:
      input.rarity === "legendary" ? 0.26 : input.rarity === "rare" ? 0.18 : 0.1,
  };
}
