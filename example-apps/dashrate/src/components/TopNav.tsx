export type View = "resources" | "my-reviews" | "settings" | "how";

export function TopNav({
  view,
  onViewChange,
}: {
  view: View;
  onViewChange: (view: View) => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">D</span>
        <h1>DashRate</h1>
      </div>
      <nav aria-label="Primary navigation">
        <button
          className={view === "resources" ? "active" : ""}
          aria-current={view === "resources" ? "page" : undefined}
          onClick={() => onViewChange("resources")}
        >
          Resources
        </button>
        <button
          className={view === "my-reviews" ? "active" : ""}
          aria-current={view === "my-reviews" ? "page" : undefined}
          onClick={() => onViewChange("my-reviews")}
        >
          My reviews
        </button>
        <button
          className={view === "settings" ? "active" : ""}
          aria-current={view === "settings" ? "page" : undefined}
          onClick={() => onViewChange("settings")}
        >
          Settings
        </button>
        <button
          className={view === "how" ? "active" : ""}
          aria-current={view === "how" ? "page" : undefined}
          onClick={() => onViewChange("how")}
        >
          How it works
        </button>
      </nav>
    </header>
  );
}
