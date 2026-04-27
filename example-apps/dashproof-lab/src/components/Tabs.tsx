export type TopTab = "anchor" | "verify" | "history";

interface TabsProps {
  value: TopTab;
  onChange: (tab: TopTab) => void;
}

const TAB_COPY: Array<{ id: TopTab; label: string; glyph: string }> = [
  { id: "anchor", label: "Anchor", glyph: "#" },
  { id: "verify", label: "Verify", glyph: "?" },
  { id: "history", label: "History", glyph: "↺" },
];

export function Tabs({ value, onChange }: TabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TAB_COPY.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              active
                ? "border-accent bg-accent text-panel"
                : "border-line bg-panel/70 text-ink-2 hover:border-line-2 hover:text-ink"
            }`}
          >
            <span className="font-mono text-xs">{tab.glyph}</span>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
