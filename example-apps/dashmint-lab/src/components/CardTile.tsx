/**
 * Presentation for a single NFT card.
 *
 * No SDK calls — it only renders a Card and emits callbacks for user
 * actions (transfer, setPrice, purchase, burn, copyId). Action buttons
 * show/hide based on owner vs. buyer vs. browse-only.
 */
import { useState, useRef, useEffect } from "react";
import type { Card } from "../dash/queries";
import type { DashSdk } from "../dash/types";
import { rarityOf } from "../lib/rarity";
import { formatCredits, truncateId, truncateName } from "../lib/format";
import { useDpnsName } from "../hooks/useDpnsName";
import { documentUrl } from "../lib/explorer";
import { CardArt } from "./CardArt";
import { StatPair } from "./StatPair";
import { RarityTag } from "./RarityTag";

export interface CardTileProps {
  card: Card;
  /** Current user's identity ID, or null in browse-only mode. */
  currentIdentityId: string | null;
  /** Connected SDK instance — used for lazy DPNS name resolution. */
  sdk?: DashSdk | null;
  onTransfer?: (card: Card) => void;
  onSetPrice?: (card: Card) => void;
  onPurchase?: (card: Card) => void;
  onBurn?: (card: Card) => void;
  onLoginPrompt?: () => void;
}

const RARITY_RAIL_COLORS = {
  common: "var(--color-rarity-common)",
  rare: "var(--color-rarity-rare)",
  legendary: "var(--color-rarity-legend)",
} as const;

function ownerAvatar(seed: string | null): string {
  if (!seed)
    return "conic-gradient(from 0deg, oklch(40% 0.02 260), oklch(30% 0.02 260))";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * 37) % 360;
  return `conic-gradient(from ${h}deg, oklch(65% 0.15 ${h}), oklch(50% 0.12 ${(h + 120) % 360}), oklch(65% 0.15 ${h}))`;
}

export function CardTile({
  card,
  currentIdentityId,
  sdk,
  onTransfer,
  onSetPrice,
  onPurchase,
  onBurn,
  onLoginPrompt,
}: CardTileProps) {
  const { data } = card;
  const atk = data.attack ?? 0;
  const def = data.defense ?? 0;
  const rarity = rarityOf(data.attack, data.defense);
  const isOwner = !!currentIdentityId && card.ownerId === currentIdentityId;
  const hasPrice = !!card.$price;
  const ownerName = useDpnsName(sdk, card.ownerId ?? null);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [menuOpen]);

  return (
    <article className="relative flex aspect-[3/4] flex-col gap-2.5 rounded-xl border border-line bg-surface p-3 pl-5 transition-[border-color,background] duration-[120ms] hover:border-line-2 hover:bg-surface-2">
      {/* Rarity left rail */}
      <span
        className={`absolute top-3 bottom-3 left-1.5 w-0.5 rounded-sm ${
          rarity === "common" ? "opacity-45" : ""
        }`}
        style={{ background: RARITY_RAIL_COLORS[rarity] }}
      />

      {/* Header: rarity tag + price */}
      <div className="flex items-center justify-between">
        <RarityTag rarity={rarity} />
        {hasPrice && (
          <span className="rounded-full border border-line-2 px-2 py-0.5 font-mono text-[11px] text-ink-2">
            {formatCredits(card.$price)} cr
          </span>
        )}
      </div>

      {/* Card art */}
      <CardArt cardId={card.id} rarity={rarity} />

      {/* Title + description (always reserve 2 lines for description) */}
      <div>
        <h3 className="text-[15px] font-semibold leading-[1.25] tracking-[-0.01em] text-ink">
          {data.name ?? "?"}
        </h3>
        <p
          className="mt-0.5 line-clamp-2 text-[11.5px] leading-[1.5] text-ink-3"
          style={{ minHeight: "2lh" }}
        >
          {data.description ?? "\u00A0"}
        </p>
      </div>

      {/* Stats */}
      <StatPair atk={atk} def={def} />

      {/* Footer: owner chip + actions */}
      <div className="mt-auto flex items-center gap-2 border-t border-line pt-2.5">
        {/* Owner chip */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <div
            className="h-[18px] w-[18px] shrink-0 rounded-full"
            style={{ background: ownerAvatar(card.ownerId) }}
          />
          <span className="truncate font-mono text-[11px] text-ink-2">
            {ownerName
              ? `@${truncateName(ownerName)}`
              : card.ownerId
                ? truncateId(card.ownerId, 6)
                : "—"}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {/* Owner, unlisted: amber "Sell" */}
          {isOwner && !hasPrice && (
            <button
              onClick={() => onSetPrice?.(card)}
              className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-bg transition hover:bg-accent-dim"
            >
              Sell
            </button>
          )}
          {/* Owner, listed: outlined "Edit price" */}
          {isOwner && hasPrice && (
            <button
              onClick={() => onSetPrice?.(card)}
              className="rounded-md border border-line-2 px-2.5 py-1 text-[11px] font-medium text-ink transition hover:border-accent-dim hover:text-ink"
            >
              Edit price
            </button>
          )}
          {/* Non-owner, marketplace, logged in: amber "Buy" */}
          {!isOwner && hasPrice && currentIdentityId && (
            <button
              onClick={() => onPurchase?.(card)}
              className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-bg transition hover:bg-accent-dim"
            >
              Buy
            </button>
          )}
          {/* Non-owner, marketplace, not logged in: outlined "Buy" */}
          {!isOwner && hasPrice && !currentIdentityId && (
            <button
              onClick={() => onLoginPrompt?.()}
              className="rounded-md border border-line-2 px-2.5 py-1 text-[11px] font-medium text-ink-3 transition hover:border-accent-dim"
            >
              Buy
            </button>
          )}

          {/* Overflow menu */}
          <div className="overflow-menu" ref={menuRef}>
            <button
              className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-line-2 text-[13px] text-ink-3 transition hover:border-accent-dim hover:text-ink-2"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More actions"
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="overflow-dropdown">
                {isOwner && (
                  <button
                    onClick={() => {
                      onTransfer?.(card);
                      setMenuOpen(false);
                    }}
                  >
                    Transfer
                  </button>
                )}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(card.id);
                    setMenuOpen(false);
                  }}
                >
                  Copy ID
                </button>
                <button
                  onClick={() => {
                    window.open(documentUrl(card.id), "_blank");
                    setMenuOpen(false);
                  }}
                >
                  View on Explorer
                </button>
                {isOwner && (
                  <>
                    <div className="my-1 h-px bg-line" />
                    <button
                      className="danger"
                      onClick={() => {
                        onBurn?.(card);
                        setMenuOpen(false);
                      }}
                    >
                      Burn Card
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
