/**
 * Tab primitives: top-level Collection/Mint, and Collection sub-tabs
 * My/All/Marketplace.
 * Top-level navigation is handled by NavButton in the AppShell sidebar.
 */

export type TopTab = "collection" | "mint" | "how-it-works";
export type CollectionSubTab = "my" | "all" | "marketplace";

export interface SubTabsProps {
  value: CollectionSubTab;
  onChange: (t: CollectionSubTab) => void;
  showMy: boolean;
}

interface SubTabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  hidden?: boolean;
}

function SubTabButton({ active, onClick, label, hidden }: SubTabButtonProps) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative pb-2.5 px-1 text-[13px] font-medium transition-colors duration-[120ms] ${
        active ? "text-ink" : "text-ink-3 hover:text-ink-2"
      }`}
    >
      {label}
      {active && (
        <span className="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-accent" />
      )}
    </button>
  );
}

export function SubTabs({ value, onChange, showMy }: SubTabsProps) {
  return (
    <div className="flex gap-4 border-b border-line">
      <SubTabButton
        active={value === "my"}
        onClick={() => onChange("my")}
        label="Yours"
        hidden={!showMy}
      />
      <SubTabButton
        active={value === "all"}
        onClick={() => onChange("all")}
        label="All"
      />
      <SubTabButton
        active={value === "marketplace"}
        onClick={() => onChange("marketplace")}
        label="Marketplace"
      />
    </div>
  );
}
