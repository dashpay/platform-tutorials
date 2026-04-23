/**
 * Mint-a-card form. Calls src/dash/mintCard directly; session provides
 * sdk, keyManager, and the contract ID.
 */
import { useState, type FormEvent } from "react";
import { drawStarterPack, STARTER_PACK_SIZE } from "../data/starterPack";
import { errorMessage } from "../dash/logger";
import { mintCard } from "../dash/mintCard";
import { useSession } from "../session/useSession";
import { OddsTable } from "./OddsTable";

export interface MintFormProps {
  contractId: string;
  onMinted?: () => void;
}

export function MintForm({ contractId, onMinted }: MintFormProps) {
  const session = useSession();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mintingPack, setMintingPack] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session.sdk || !session.keyManager) return;
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

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">New card</h2>
          <p className="mt-1 max-w-[44ch] text-[12px] leading-[1.55] text-ink-3">
            Creates a document on the Dash Platform contract. Attack and defense
            are randomly chosen.
          </p>
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
          disabled={submitting || !name.trim()}
          className="h-10 rounded-md bg-accent px-[18px] text-[13px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
        >
          {submitting ? "Minting…" : "Mint card"}
        </button>
      </form>

      <OddsTable />

      {/* Starter pack */}
      <div className="flex flex-col gap-2 border-t border-line pt-5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
          Starter Pack
        </h2>
        <p className="text-[12px] leading-[1.55] text-ink-3">
          Mint a random set of {STARTER_PACK_SIZE} sample cards from the
          tutorial card pool.
        </p>
        <button
          type="button"
          onClick={handleStarterPack}
          disabled={mintingPack}
          className="self-start rounded-md border border-line-2 px-4 py-2 text-[13px] font-semibold text-ink transition hover:border-accent-dim hover:text-ink disabled:cursor-not-allowed disabled:border-line disabled:text-ink-4"
        >
          {mintingPack ? "Minting…" : "Mint Starter Pack"}
        </button>
      </div>
    </div>
  );
}
