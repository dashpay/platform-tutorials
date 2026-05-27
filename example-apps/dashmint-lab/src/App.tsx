import { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";

import {
  listAllCards,
  listMarketplaceCards,
  listMyCards,
  type Card,
} from "./dash/queries";

import { useSession } from "./session/useSession";

import { AppShell } from "./components/AppShell";
import { BurnModal } from "./components/BurnModal";
import { CardGrid } from "./components/CardGrid";
import { CollectionToolbar } from "./components/CollectionToolbar";
import { LoginModal } from "./components/LoginModal";
import { MintForm } from "./components/MintForm";
import { PurchaseModal } from "./components/PurchaseModal";
import { SetPriceModal } from "./components/SetPriceModal";
import { SubTabs, type CollectionSubTab, type TopTab } from "./components/Tabs";
import { TransferModal } from "./components/TransferModal";
import { HowItWorks } from "./components/HowItWorks";
import { errorMessage } from "./dash/logger";
import { formatCredits } from "./lib/format";

type ModalCard = Card | null;
type SortKey = "rarity" | "name" | "owner" | "price";
const SORT_LABELS: Record<SortKey, string> = {
  rarity: "Rarity",
  name: "Name",
  owner: "Owner",
  price: "Price",
};
const SORT_ORDER: SortKey[] = ["rarity", "name", "owner", "price"];

function App() {
  const session = useSession();
  const {
    status,
    sdk,
    identityId,
    contractId,
    balance,
    dashMintTokenBalance,
    refreshBalance,
    log,
    browseOnly,
  } = session;

  const [tab, setTab] = useState<TopTab>("collection");
  const [subTab, setSubTab] = useState<CollectionSubTab>("all");
  const [loginOpen, setLoginOpen] = useState(false);
  const [transferCard, setTransferCard] = useState<ModalCard>(null);
  const [priceCard, setPriceCard] = useState<ModalCard>(null);
  const [purchaseCardState, setPurchaseCardState] = useState<ModalCard>(null);
  const [burnCardState, setBurnCardState] = useState<ModalCard>(null);

  const [sortKey, setSortKey] = useState<SortKey>("rarity");

  const [cards, setCards] = useState<Card[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const refresh = useCallback(() => {
    setRefreshNonce((n) => n + 1);
    refreshBalance();
  }, [refreshBalance]);

  // Auto-connect in browse-only mode so read tabs work without login.
  // Defer to the next frame so the shell paints before the SDK chunk
  // (~8MB WASM) starts downloading.
  useEffect(() => {
    if (status !== "idle") return;
    const raf = requestAnimationFrame(() => void browseOnly());
    return () => cancelAnimationFrame(raf);
  }, [status, browseOnly]);

  // Default sub-tab: "My" when logged in, otherwise "All".
  useEffect(() => {
    if (status === "authenticated") setSubTab("my");
    else if (status === "browsing") setSubTab("all");
  }, [status]);

  // Load cards for the current sub-tab whenever dependencies change.
  useEffect(() => {
    if (!sdk || !contractId) {
      setCards([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingCards(true);
      try {
        let result: Card[];
        if (subTab === "my" && identityId) {
          result = await listMyCards({ sdk, contractId, identityId, log });
        } else if (subTab === "marketplace") {
          result = await listMarketplaceCards({ sdk, contractId, log });
        } else {
          result = await listAllCards({ sdk, contractId, log });
        }
        if (!cancelled) setCards(result);
      } catch (err) {
        if (!cancelled) {
          log(`Query failed: ${errorMessage(err)}`, "error");
          setCards([]);
        }
      } finally {
        if (!cancelled) setLoadingCards(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sdk, contractId, subTab, identityId, refreshNonce, log]);

  // Sort cards for the collection grid.
  const sortedCards = useMemo(() => {
    if (sortKey === "rarity") {
      return [...cards].sort((a, b) => {
        const sa = (a.data.attack ?? 0) + (a.data.defense ?? 0);
        const sb = (b.data.attack ?? 0) + (b.data.defense ?? 0);
        return sb - sa;
      });
    } else if (sortKey === "name") {
      return [...cards].sort((a, b) =>
        (a.data.name ?? "").localeCompare(b.data.name ?? ""),
      );
    } else if (sortKey === "owner") {
      return [...cards].sort((a, b) =>
        (a.ownerId ?? "").localeCompare(b.ownerId ?? ""),
      );
    } else if (sortKey === "price") {
      return [...cards].sort((a, b) => {
        const pa = a.$price ? Number(a.$price) : -1;
        const pb = b.$price ? Number(b.$price) : -1;
        return pb - pa;
      });
    }
    return cards;
  }, [cards, sortKey]);

  function handleBurn(card: Card) {
    setBurnCardState(card);
  }

  const screenTitles: Record<TopTab, { title: string; subtitle: string }> = {
    collection: {
      title: "Collection",
      subtitle: "Browse, trade, and manage collectible cards on Dash Platform.",
    },
    mint: {
      title: "Mint",
      subtitle:
        "Create collectible cards on Dash Platform using DashMint tokens.",
    },
    "how-it-works": {
      title: "How it works",
      subtitle: "Understand the building blocks behind DashMint Lab.",
    },
  };

  const { title, subtitle } = screenTitles[tab];

  return (
    <>
      <Toaster
        position="bottom-center"
        theme="dark"
        richColors
        duration={2200}
      />

      <AppShell
        tab={tab}
        onTabChange={setTab}
        status={status}
        identityId={identityId}
        sdk={sdk}
        onLoginOpen={() => setLoginOpen(true)}
      >
        {/* Screen header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold leading-[1.15] tracking-tight text-ink">
              {title}
            </h1>
            <p className="mt-1 text-[12.5px] text-ink-3">{subtitle}</p>
          </div>
          {balance !== null && (
            <div className="shrink-0 text-right">
              <div className="text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-4">
                Balance
              </div>
              <div className="mt-0.5 font-mono text-[14px] font-medium tracking-tight text-ink-3">
                {formatCredits(balance)}
                <span className="ml-1 text-[11px] text-ink-4">credits</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Collection ────────────────────────────────────────────── */}
        {tab === "collection" && (
          <section>
            <div className="flex items-end justify-between">
              <SubTabs
                value={subTab}
                onChange={setSubTab}
                showMy={status === "authenticated"}
              />
              <CollectionToolbar
                sortLabel={SORT_LABELS[sortKey]}
                onSortClick={() =>
                  setSortKey((k) => {
                    const i = SORT_ORDER.indexOf(k);
                    return SORT_ORDER[(i + 1) % SORT_ORDER.length];
                  })
                }
              />
            </div>
            <div className="mt-4">
              {loadingCards ? (
                <div className="rounded-lg border border-dashed border-line px-6 py-12 text-center text-ink-4">
                  Loading…
                </div>
              ) : (
                <CardGrid
                  cards={sortedCards}
                  currentIdentityId={identityId}
                  sdk={sdk}
                  emptyMessage={
                    subTab === "my"
                      ? "You don\u2019t own any cards yet. Mint one!"
                      : subTab === "marketplace"
                        ? "No cards for sale right now."
                        : "No cards found."
                  }
                  onTransfer={setTransferCard}
                  onSetPrice={setPriceCard}
                  onPurchase={setPurchaseCardState}
                  onBurn={handleBurn}
                  onLoginPrompt={() => setLoginOpen(true)}
                />
              )}
            </div>
          </section>
        )}

        {/* ── Mint ──────────────────────────────────────────────────── */}
        {tab === "mint" && (
          <section className="relative">
            {/* Overlay: not logged in */}
            {status !== "authenticated" && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-bg/55 backdrop-blur-sm">
                <p className="text-sm text-ink-2">
                  Login to burn DashMint tokens and create cards
                </p>
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-bg transition hover:bg-accent-dim"
                >
                  Login
                </button>
              </div>
            )}
            {contractId && (
              <div className="mx-auto max-w-[540px]">
                <MintForm
                  contractId={contractId}
                  dashMintTokenBalance={dashMintTokenBalance}
                  onMinted={refresh}
                />
              </div>
            )}
          </section>
        )}

        {/* ── How it works ──────────────────────────────────────────── */}
        {tab === "how-it-works" && (
          <section>
            <HowItWorks />
          </section>
        )}
      </AppShell>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <TransferModal
        card={transferCard}
        onClose={() => setTransferCard(null)}
        onTransferred={refresh}
      />
      <SetPriceModal
        card={priceCard}
        onClose={() => setPriceCard(null)}
        onPriced={refresh}
      />
      <PurchaseModal
        card={purchaseCardState}
        onClose={() => setPurchaseCardState(null)}
        onPurchased={refresh}
      />
      <BurnModal
        card={burnCardState}
        onClose={() => setBurnCardState(null)}
        onBurned={refresh}
      />
    </>
  );
}
export default App;
