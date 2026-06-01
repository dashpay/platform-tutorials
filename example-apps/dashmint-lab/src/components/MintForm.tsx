/**
 * Mint-a-card form. Calls src/dash/mintCard directly; session provides
 * sdk, keyManager, and the contract ID.
 */
import { useEffect, useState, type FormEvent } from "react";
import { drawStarterPack, STARTER_PACK_SIZE } from "../data/starterPack";
import { errorMessage } from "../dash/logger";
import { mintCard } from "../dash/mintCard";
import {
  DASHMINT_TOKEN_COST,
  DASHMINT_TOKEN_SUPPLY,
  fetchCardsMintedCount,
} from "../dash/dashMintToken";
import { useSession } from "../session/useSession";
import { OddsTable } from "./OddsTable";

// Module-level cache so the supply count survives tab unmounts. When the
// user navigates back to Mint we render the last known value immediately
// and silently refetch — no "—" placeholder flash.
const mintedCountCache = new Map<string, bigint>();

export interface MintFormProps {
  contractId: string;
  dashMintTokenBalance?: bigint | null;
  onMinted?: () => void;
}

export function MintForm({
  contractId,
  dashMintTokenBalance = null,
  onMinted,
}: MintFormProps) {
  const session = useSession();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mintingPack, setMintingPack] = useState(false);
  const [mintedCount, setMintedCount] = useState<bigint | null>(
    () => mintedCountCache.get(contractId) ?? null,
  );
  const starterPackTokenCost = BigInt(STARTER_PACK_SIZE);

  useEffect(() => {
    if (!session.sdk) return;
    let cancelled = false;
    fetchCardsMintedCount({ sdk: session.sdk, contractId })
      .then((count) => {
        mintedCountCache.set(contractId, count);
        if (!cancelled) setMintedCount(count);
      })
      .catch(() => {
        // Keep the previous (possibly cached) value on failure so the UI
        // doesn't regress to "—" just because a refetch hiccuped.
      });
    return () => {
      cancelled = true;
    };
  }, [session.sdk, contractId, submitting, mintingPack]);
  const soldOut = mintedCount !== null && mintedCount >= DASHMINT_TOKEN_SUPPLY;
  const starterPackSoldOut =
    mintedCount !== null &&
    DASHMINT_TOKEN_SUPPLY - mintedCount < starterPackTokenCost;
  const hasInsufficientTokensForCard =
    dashMintTokenBalance !== null && dashMintTokenBalance < DASHMINT_TOKEN_COST;
  const hasInsufficientTokensForStarterPack =
    dashMintTokenBalance !== null &&
    dashMintTokenBalance < starterPackTokenCost;
  const mintedPercent =
    mintedCount === null
      ? 0
      : Math.min(100, Number((mintedCount * 100n) / DASHMINT_TOKEN_SUPPLY));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session.sdk || !session.keyManager) return;
    if (submitting || mintingPack || soldOut || hasInsufficientTokensForCard) {
      return;
    }
    setSubmitting(true);
    try {
      await mintCard({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId,
        card: { name, description },
        log: session.log,
      });
      setName("");
      setDescription("");
      onMinted?.();
    } catch (err) {
      session.log(`Mint error: ${errorMessage(err)}`, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStarterPack() {
    if (!session.sdk || !session.keyManager) return;
    if (
      submitting ||
      mintingPack ||
      starterPackSoldOut ||
      hasInsufficientTokensForStarterPack
    ) {
      return;
    }
    setMintingPack(true);
    session.log(`Minting starter pack (${STARTER_PACK_SIZE} cards)…`);
    try {
      const packCards = drawStarterPack();
      for (const card of packCards) {
        await mintCard({
          sdk: session.sdk,
          keyManager: session.keyManager,
          contractId,
          card,
          log: session.log,
        });
      }
      session.log("Starter pack minted!", "success");
      onMinted?.();
    } catch (err) {
      session.log(`Starter pack error: ${errorMessage(err)}`, "error");
    } finally {
      setMintingPack(false);
    }
  }

  const supplyBlock = (
    <div className="rounded-md border border-line bg-bg px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
        Supply
      </div>
      <div className="mt-1 font-mono text-[14px] text-ink">
        {mintedCount === null
          ? "—"
          : `${mintedCount.toString()} / ${DASHMINT_TOKEN_SUPPLY.toString()} minted`}
      </div>
      {mintedCount !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full ${soldOut ? "bg-danger" : "bg-accent"}`}
            style={{ width: `${mintedPercent}%` }}
          />
        </div>
      )}
      {soldOut && (
        <p className="mt-2 rounded-md border border-[oklch(30%_0.08_25)] bg-[oklch(22%_0.04_25)] px-3 py-2 text-[12px] font-medium leading-[1.45] text-danger">
          All cards have been minted.
        </p>
      )}
    </div>
  );

  if (soldOut) {
    return (
      <div className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5">
        {supplyBlock}
        <OddsTable />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">New card</h2>
          <p className="mt-1 max-w-[44ch] text-[12px] leading-[1.55] text-ink-3">
            Mint a unique collectible card. Costs 1 DashMint token.
          </p>
        </div>

        {supplyBlock}

        <div className="rounded-md border border-line bg-bg px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
            Your DashMint token balance
          </div>
          <div className="mt-1 font-mono text-[14px] text-ink">
            {dashMintTokenBalance === null
              ? "Unavailable"
              : dashMintTokenBalance.toString()}
          </div>
          {dashMintTokenBalance === 0n ? (
            <p className="mt-2 rounded-md border border-[oklch(30%_0.08_25)] bg-[oklch(22%_0.04_25)] px-3 py-2 text-[12px] font-medium leading-[1.45] text-danger">
              You need at least 1 DashMint token to mint a card.
            </p>
          ) : (
            <p className="mt-1 text-[11px] leading-[1.45] text-ink-4">
              Fresh contracts start with 100 DashMint tokens.
            </p>
          )}
        </div>

        {/* Name field */}
        <label className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              Name
            </span>
            <span className="font-mono text-[11px] text-ink-4">
              {name.length} / 63
            </span>
          </div>
          <input
            type="text"
            required
            maxLength={63}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Fire Dragon"
            className="h-9 rounded-md border border-line bg-bg px-3 text-[13px] text-ink outline-none transition focus:border-accent-dim"
          />
        </label>

        {/* Description field */}
        <label className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              Description
            </span>
            <span className="font-mono text-[11px] text-ink-4">
              {description.length} / 256
            </span>
          </div>
          <textarea
            maxLength={256}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. A legendary beast from the volcanic plains"
            className="resize-none rounded-md border border-line bg-bg px-3 py-2 text-[13px] text-ink outline-none transition focus:border-accent-dim"
          />
        </label>

        <button
          type="submit"
          disabled={
            submitting ||
            mintingPack ||
            !name.trim() ||
            hasInsufficientTokensForCard
          }
          className="h-10 rounded-md bg-accent px-[18px] text-[13px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
        >
          {submitting ? "Minting…" : "Mint Card"}
        </button>
      </form>

      <OddsTable />

      {/* Starter pack */}
      <div className="flex flex-col gap-2 border-t border-line pt-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
          Starter Pack
        </h2>
        <p className="text-[12px] leading-[1.55] text-ink-3">
          Mint a random set of sample cards from the tutorial collection. Costs{" "}
          {STARTER_PACK_SIZE} DashMint tokens.
        </p>
        {starterPackSoldOut ? (
          <p className="rounded-md border border-[oklch(30%_0.08_25)] bg-[oklch(22%_0.04_25)] px-3 py-2 text-[12px] font-medium leading-[1.45] text-danger">
            Not enough remaining supply for a Starter Pack.
          </p>
        ) : (
          hasInsufficientTokensForStarterPack && (
            <p className="rounded-md border border-[oklch(30%_0.08_25)] bg-[oklch(22%_0.04_25)] px-3 py-2 text-[12px] font-medium leading-[1.45] text-danger">
              You need {STARTER_PACK_SIZE} DashMint tokens to open a Starter
              Pack.
            </p>
          )
        )}
        <button
          type="button"
          onClick={handleStarterPack}
          disabled={
            submitting ||
            mintingPack ||
            starterPackSoldOut ||
            hasInsufficientTokensForStarterPack
          }
          className="h-10 rounded-md border border-line-2 px-[18px] text-[13px] font-semibold text-ink transition hover:border-accent-dim hover:text-ink disabled:cursor-not-allowed disabled:border-line disabled:text-ink-4"
        >
          {mintingPack
            ? "Minting…"
            : starterPackSoldOut
              ? "Sold out"
              : "Open Starter Pack"}
        </button>
      </div>
    </div>
  );
}
