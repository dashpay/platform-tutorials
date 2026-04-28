/**
 * Deterministic inline SVG card art.
 * Theme comes from card text, while stats and rarity shape the composition.
 */
import { useId } from "react";
import { buildArtRecipe, type ArtRecipe } from "../lib/cardArt";
import type { Rarity } from "../lib/rarity";

interface CardArtProps {
  cardId: string;
  rarity: Rarity;
  name?: string | null;
  description?: string | null;
  attack?: number;
  defense?: number;
  size?: "sm" | "md";
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

function buildSparkles(recipe: ArtRecipe) {
  const random = mulberry32(recipe.seed ^ 0x9e3779b9);
  return Array.from({ length: recipe.fxCount }, (_, index) => ({
    key: `sparkle-${index}`,
    cx: 24 + random() * 132,
    cy: 14 + random() * 64,
    r: 1.2 + random() * 2.6 + (recipe.rarity === "legendary" ? 0.4 : 0),
    opacity: 0.18 + random() * 0.22,
  }));
}

function buildSlashes(recipe: ArtRecipe) {
  const random = mulberry32(recipe.seed ^ 0x85ebca6b);
  return Array.from({ length: recipe.slashCount }, (_, index) => {
    const startX = 106 + index * 12 + random() * 4;
    const startY = 30 + random() * 42;
    const length = 9 + recipe.attackBias * 16 + random() * 4;
    return {
      key: `slash-${index}`,
      d: `M ${startX} ${startY} L ${startX + length} ${startY - length * 0.8}`,
      opacity: 0.18 + recipe.attackBias * 0.28,
    };
  });
}

function renderBackdrop(recipe: ArtRecipe, terrainId: string) {
  const { palette, theme, terrainLift, highlightOpacity } = recipe;

  switch (theme) {
    case "inferno":
      return (
        <>
          <path
            d={`M 0 88 C 28 72, 54 96, 78 82 C 102 68, 128 104, 180 78 L 180 120 L 0 120 Z`}
            fill={palette.terrain}
          />
          <path
            d="M 16 96 L 38 78 L 50 98 Z M 78 96 L 102 70 L 118 98 Z M 132 96 L 156 72 L 172 98 Z"
            fill={palette.accentSoft}
            opacity={0.55}
          />
        </>
      );
    case "storm":
      return (
        <>
          <ellipse
            cx="66"
            cy="34"
            rx="42"
            ry="16"
            fill={palette.accentSoft}
            opacity={0.24}
          />
          <ellipse
            cx="118"
            cy="28"
            rx="46"
            ry="18"
            fill={palette.glow}
            opacity={0.15}
          />
          <path
            d="M 136 18 L 120 48 L 135 48 L 118 80 L 154 42 L 136 42 Z"
            fill={palette.accent}
            opacity={0.8}
          />
          <path
            d={`M 0 ${terrainLift} C 34 70, 74 86, 110 78 C 138 72, 164 84, 180 76 L 180 120 L 0 120 Z`}
            fill={palette.terrain}
          />
        </>
      );
    case "frost":
      return (
        <>
          <path
            d={`M 0 120 L 0 ${terrainLift + 4} L 22 86 L 38 100 L 62 72 L 82 102 L 108 64 L 128 104 L 148 84 L 180 112 L 180 120 Z`}
            fill={palette.terrain}
          />
          <path
            d="M 34 32 L 44 16 L 54 34 Z M 78 26 L 90 8 L 102 28 Z M 130 34 L 142 14 L 154 34 Z"
            fill={palette.glow}
            opacity={0.5}
          />
        </>
      );
    case "shadow":
      return (
        <>
          <ellipse
            cx="54"
            cy="52"
            rx="54"
            ry="22"
            fill={palette.accentSoft}
            opacity={0.18}
          />
          <ellipse
            cx="134"
            cy="36"
            rx="36"
            ry="14"
            fill={palette.glow}
            opacity={0.12}
          />
          <path
            d={`M 0 ${terrainLift + 6} C 38 84, 88 92, 128 82 C 152 76, 166 88, 180 86 L 180 120 L 0 120 Z`}
            fill={palette.terrain}
          />
        </>
      );
    case "earth":
      return (
        <>
          <path
            d={`M 0 ${terrainLift} L 20 84 L 38 88 L 54 74 L 72 80 L 90 66 L 112 78 L 130 68 L 146 82 L 180 74 L 180 120 L 0 120 Z`}
            fill={palette.terrain}
          />
          <path
            d="M 20 96 H 68 V 104 H 20 Z M 86 90 H 140 V 100 H 86 Z"
            fill={palette.shadow}
            opacity={0.4}
          />
        </>
      );
    case "crystal":
      return (
        <>
          <path
            d={`M 0 120 L 0 ${terrainLift + 4} L 30 86 L 52 98 L 84 62 L 106 100 L 134 70 L 154 104 L 180 82 L 180 120 Z`}
            fill={palette.terrain}
          />
          <path
            d="M 24 84 L 40 48 L 56 84 Z M 108 88 L 128 40 L 146 88 Z"
            fill={palette.glow}
            opacity={0.3}
          />
        </>
      );
    case "solar":
      return (
        <>
          <circle cx="132" cy="28" r="24" fill={palette.glow} opacity={0.26} />
          <path
            d={`M 0 ${terrainLift + 2} C 42 78, 76 94, 118 82 C 146 74, 162 84, 180 78 L 180 120 L 0 120 Z`}
            fill={palette.terrain}
          />
          <path
            d="M 60 94 H 120 V 100 H 60 Z M 72 86 H 108 V 92 H 72 Z"
            fill={palette.accentSoft}
            opacity={0.5}
          />
        </>
      );
    default:
      return (
        <>
          <path
            d={`M 0 ${terrainLift + 4} L 34 84 L 72 92 L 112 74 L 180 86 L 180 120 L 0 120 Z`}
            fill={palette.terrain}
          />
          <path
            d={`M 0 82 L 56 44 L 80 60 L 128 24 L 180 48 L 180 60 L 128 36 L 80 72 L 56 56 L 0 94 Z`}
            fill={`url(#${terrainId})`}
            opacity={highlightOpacity}
          />
        </>
      );
  }
}

function renderSubject(recipe: ArtRecipe) {
  const {
    theme,
    palette,
    attackBias,
    defenseBias,
    offsetX,
    offsetY,
    rotation,
    subjectScale,
  } = recipe;
  const cx = 90 + offsetX;
  const cy = 60 + offsetY;
  const bodyFill = palette.shadow;
  const accentFill = palette.accent;
  const softFill = palette.accentSoft;
  const transform = `translate(${cx} ${cy}) rotate(${rotation}) scale(${subjectScale}) translate(${-cx} ${-cy})`;

  switch (theme) {
    case "inferno":
      return (
        <g transform={transform}>
          <polygon
            points={`${cx - 42} ${cy + 6}, ${cx - 10} ${cy - 18}, ${cx - 16} ${cy + 18}`}
            fill={softFill}
            opacity={0.9}
          />
          <polygon
            points={`${cx + 42} ${cy + 6}, ${cx + 10} ${cy - 18}, ${cx + 16} ${cy + 18}`}
            fill={softFill}
            opacity={0.9}
          />
          <path
            d={`M ${cx} ${cy + 24} C ${cx - 18} ${cy + 8}, ${cx - 12} ${cy - 10}, ${cx} ${cy - 34} C ${cx + 8} ${cy - 10}, ${cx + 20} ${cy + 6}, ${cx} ${cy + 24} Z`}
            fill={accentFill}
          />
          <path
            d={`M ${cx - 8} ${cy + 8} C ${cx - 2} ${cy - 6}, ${cx + 4} ${cy - 18}, ${cx + 10} ${cy + 2} C ${cx + 4} ${cy + 4}, ${cx - 2} ${cy + 8}, ${cx - 8} ${cy + 8} Z`}
            fill={palette.glow}
            opacity={0.78}
          />
        </g>
      );
    case "storm":
      return (
        <g transform={transform}>
          <polygon
            points={`${cx - 40} ${cy + 6}, ${cx - 8} ${cy - 24}, ${cx - 2} ${cy - 6}, ${cx - 20} ${cy + 18}`}
            fill={softFill}
          />
          <polygon
            points={`${cx + 44} ${cy + 4}, ${cx + 10} ${cy - 26}, ${cx + 2} ${cy - 8}, ${cx + 20} ${cy + 16}`}
            fill={softFill}
          />
          <path
            d={`M ${cx - 10} ${cy - 6} L ${cx + 4} ${cy - 26} L ${cx + 2} ${cy - 10} L ${cx + 18} ${cy - 12} L ${cx - 2} ${cy + 24} L ${cx + 2} ${cy + 2} L ${cx - 12} ${cy + 4} Z`}
            fill={accentFill}
          />
          <circle
            cx={cx - 4}
            cy={cy - 4}
            r={2 + attackBias * 1.6}
            fill={palette.glow}
          />
        </g>
      );
    case "frost":
      return (
        <g transform={transform}>
          <path
            d={`M ${cx} ${cy - 34} L ${cx + 28} ${cy - 10} L ${cx + 18} ${cy + 28} L ${cx - 18} ${cy + 28} L ${cx - 28} ${cy - 10} Z`}
            fill={bodyFill}
          />
          <path
            d={`M ${cx} ${cy - 28} L ${cx + 18} ${cy - 8} L ${cx + 10} ${cy + 20} L ${cx - 10} ${cy + 20} L ${cx - 18} ${cy - 8} Z`}
            fill={accentFill}
          />
          <path
            d={`M ${cx - 18} ${cy - 18} L ${cx - 8} ${cy - 36} L ${cx} ${cy - 20} L ${cx + 8} ${cy - 40} L ${cx + 20} ${cy - 16}`}
            fill="none"
            stroke={palette.glow}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
      );
    case "shadow":
      return (
        <g transform={transform}>
          <polygon
            points={`${cx} ${cy - 34}, ${cx - 16} ${cy - 12}, ${cx - 32} ${cy + 4}, ${cx - 18} ${cy + 26}, ${cx} ${cy + 18}, ${cx + 18} ${cy + 26}, ${cx + 32} ${cy + 4}, ${cx + 16} ${cy - 12}`}
            fill={bodyFill}
          />
          <polygon
            points={`${cx - 12} ${cy - 6}, ${cx - 4} ${cy + 4}, ${cx - 18} ${cy + 6}`}
            fill={palette.glow}
          />
          <polygon
            points={`${cx + 12} ${cy - 6}, ${cx + 4} ${cy + 4}, ${cx + 18} ${cy + 6}`}
            fill={palette.glow}
          />
          <path
            d={`M ${cx - 10} ${cy + 10} Q ${cx} ${cy + 18} ${cx + 10} ${cy + 10}`}
            fill="none"
            stroke={accentFill}
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.72}
          />
        </g>
      );
    case "earth":
      return (
        <g transform={transform}>
          <rect
            x={cx - 26}
            y={cy - 18}
            width={52}
            height={38}
            rx={8}
            fill={bodyFill}
          />
          <rect
            x={cx - 16}
            y={cy - 36}
            width={32}
            height={24}
            rx={6}
            fill={bodyFill}
          />
          <rect
            x={cx - 18}
            y={cy - 12}
            width={36}
            height={26}
            rx={6}
            fill={accentFill}
          />
          <path
            d={`M ${cx - 24} ${cy + 2} C ${cx - 34} ${cy + 4}, ${cx - 34} ${cy + 24}, ${cx - 12} ${cy + 14}`}
            fill="none"
            stroke={palette.glow}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <path
            d={`M ${cx + 24} ${cy + 2} C ${cx + 34} ${cy + 4}, ${cx + 34} ${cy + 24}, ${cx + 12} ${cy + 14}`}
            fill="none"
            stroke={palette.glow}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
      );
    case "crystal":
      return (
        <g transform={transform}>
          <path
            d={`M ${cx} ${cy - 34} L ${cx + 22} ${cy - 6} L ${cx} ${cy + 30} L ${cx - 22} ${cy - 6} Z`}
            fill={accentFill}
          />
          <path
            d={`M ${cx - 10} ${cy + 12} C ${cx + 20} ${cy + 2}, ${cx + 22} ${cy - 22}, ${cx - 6} ${cy - 24}`}
            fill="none"
            stroke={bodyFill}
            strokeWidth={7 + defenseBias * 3}
            strokeLinecap="round"
          />
          <path
            d={`M ${cx + 16} ${cy - 16} L ${cx + 34} ${cy - 30} L ${cx + 28} ${cy - 4} Z`}
            fill={palette.glow}
            opacity={0.72}
          />
        </g>
      );
    case "solar":
      return (
        <g transform={transform}>
          <circle
            cx={cx}
            cy={cy - 18}
            r={16 + attackBias * 4}
            fill="none"
            stroke={palette.glow}
            strokeWidth={4}
            opacity={0.76}
          />
          <path
            d={`M ${cx} ${cy - 10} L ${cx + 20} ${cy + 28} L ${cx - 20} ${cy + 28} Z`}
            fill={accentFill}
          />
          <rect
            x={cx - 7}
            y={cy - 2}
            width={14}
            height={26}
            rx={6}
            fill={bodyFill}
          />
          <path
            d={`M ${cx - 20} ${cy} Q ${cx} ${cy - 18} ${cx + 20} ${cy}`}
            fill="none"
            stroke={palette.accentSoft}
            strokeWidth={4}
            strokeLinecap="round"
          />
        </g>
      );
    default:
      return (
        <g transform={transform}>
          <path
            d={`M ${cx} ${cy - 34} L ${cx + 28} ${cy - 6} L ${cx + 10} ${cy + 28} L ${cx - 10} ${cy + 28} L ${cx - 28} ${cy - 6} Z`}
            fill={bodyFill}
          />
          <path
            d={`M ${cx} ${cy - 22} L ${cx + 18} ${cy - 2} L ${cx} ${cy + 20} L ${cx - 18} ${cy - 2} Z`}
            fill={accentFill}
          />
        </g>
      );
  }
}

export function CardArt({
  cardId,
  rarity,
  name,
  description,
  attack,
  defense,
  size = "md",
}: CardArtProps) {
  const recipe = buildArtRecipe({
    cardId,
    rarity,
    name,
    description,
    attack,
    defense,
  });
  const idBase = useId().replace(/:/g, "");
  const gradientId = `${idBase}-gradient`;
  const glowId = `${idBase}-glow`;
  const terrainId = `${idBase}-terrain`;
  const height = size === "sm" ? 88 : 132;
  const truncId = cardId.length > 8 ? `#${cardId.slice(0, 6)}` : `#${cardId}`;
  const sparkles = buildSparkles(recipe);
  const slashes = buildSlashes(recipe);

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-white/[0.06] bg-surface-2"
      data-art-theme={recipe.theme}
      data-art-rarity={rarity}
      style={{
        height,
      }}
    >
      <svg
        viewBox="0 0 180 120"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={recipe.palette.bgTop} />
            <stop offset="100%" stopColor={recipe.palette.bgBottom} />
          </linearGradient>
          <radialGradient id={glowId} cx="50%" cy="38%" r="60%">
            <stop
              offset="0%"
              stopColor={recipe.palette.glow}
              stopOpacity={recipe.glowOpacity}
            />
            <stop
              offset="100%"
              stopColor={recipe.palette.glow}
              stopOpacity="0"
            />
          </radialGradient>
          <linearGradient id={terrainId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={recipe.palette.accentSoft} />
            <stop offset="100%" stopColor={recipe.palette.accent} />
          </linearGradient>
        </defs>

        <rect width="180" height="120" fill={`url(#${gradientId})`} />
        <rect width="180" height="120" fill={`url(#${glowId})`} />

        {renderBackdrop(recipe, terrainId)}

        <ellipse
          cx={90 + recipe.offsetX * 0.4}
          cy={62 + recipe.offsetY * 0.3}
          rx={26 + recipe.defenseBias * 22}
          ry={18 + recipe.defenseBias * 14}
          fill="none"
          stroke={recipe.palette.rim}
          strokeWidth={2.5 + recipe.defenseBias * 2}
          opacity={recipe.shieldOpacity}
        />

        {slashes.map((slash) => (
          <path
            key={slash.key}
            d={slash.d}
            fill="none"
            stroke={recipe.palette.accent}
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity={slash.opacity}
          />
        ))}

        {renderSubject(recipe)}

        {sparkles.map((sparkle) => (
          <circle
            key={sparkle.key}
            cx={sparkle.cx}
            cy={sparkle.cy}
            r={sparkle.r}
            fill={recipe.palette.glow}
            opacity={sparkle.opacity}
          />
        ))}

        {rarity !== "common" && (
          <rect
            x="4"
            y="4"
            width="172"
            height="112"
            rx="14"
            fill="none"
            stroke={recipe.palette.rim}
            strokeOpacity={rarity === "legendary" ? 0.55 : 0.3}
            strokeWidth={rarity === "legendary" ? 2.2 : 1.4}
          />
        )}

        <rect
          x="0.5"
          y="0.5"
          width="179"
          height="119"
          rx="15.5"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
        />

        <text
          x="10"
          y="110"
          fill="rgba(255,255,255,0.34)"
          fontSize="8"
          fontFamily="JetBrains Mono, monospace"
          letterSpacing="0.12em"
        >
          {truncId}
        </text>
      </svg>
    </div>
  );
}
