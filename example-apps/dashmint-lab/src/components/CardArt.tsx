/**
 * Deterministic stripe art placeholder for card tiles.
 * Generates a diagonal stripe pattern keyed to card ID + rarity.
 * The slot is forward-compatible with real artwork later.
 */
import type { Rarity } from "../lib/rarity";

interface CardArtProps {
  cardId: string;
  rarity: Rarity;
  size?: "sm" | "md";
}

function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h += id.charCodeAt(i);
  return h;
}

function stripeColors(rarity: Rarity, seed: number) {
  const hue = (seed * 37) % 360;
  switch (rarity) {
    case "legendary":
      return {
        base: `oklch(32% 0.06 75)`,
        stripe: `oklch(40% 0.10 75)`,
      };
    case "rare":
      return {
        base: `oklch(28% 0.06 230)`,
        stripe: `oklch(36% 0.10 230)`,
      };
    default:
      return {
        base: `oklch(24% 0.02 ${hue})`,
        stripe: `oklch(30% 0.04 ${hue})`,
      };
  }
}

export function CardArt({ cardId, rarity, size = "md" }: CardArtProps) {
  const seed = seedFromId(cardId);
  const { base, stripe } = stripeColors(rarity, seed);
  const height = size === "sm" ? 80 : 112;
  const truncId = cardId.length > 8 ? `#${cardId.slice(0, 6)}` : `#${cardId}`;

  return (
    <div
      className="relative overflow-hidden rounded-lg"
      style={{
        height,
        background: `repeating-linear-gradient(135deg, ${base} 0px 16px, ${stripe} 16px 17px)`,
      }}
    >
      {/* Sheen overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.04) 0%, transparent 60%)",
        }}
      />
      {/* Inset shadow */}
      <div
        className="absolute inset-0"
        style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)" }}
      />
      {/* Card ID watermark */}
      <span className="absolute bottom-1.5 left-2 font-mono text-[9px] text-white/[0.35]">
        {truncId}
      </span>
    </div>
  );
}
