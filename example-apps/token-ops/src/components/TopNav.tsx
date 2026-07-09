import { shortId } from "../lib/format";
import type { SessionStatus } from "../session/SessionContext";

export type View =
  "overview" | "operations" | "pending" | "governance" | "settings";

const TABS: { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "operations", label: "Operations" },
  { id: "pending", label: "Pending" },
  { id: "governance", label: "Governance" },
  { id: "settings", label: "Settings" },
];

export function TopNav({
  view,
  onViewChange,
  status,
  identityId,
  onLoginClick,
  onLogout,
}: {
  view: View;
  onViewChange: (view: View) => void;
  status: SessionStatus;
  identityId: string | null;
  onLoginClick: () => void;
  onLogout: () => void;
}) {
  const isAuthenticated = status === "authenticated" && Boolean(identityId);

  return (
    <div className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <h1>TokenOps</h1>
      </div>
      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={view === tab.id ? "active" : ""}
            onClick={() => onViewChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="topbar-auth">
        {isAuthenticated ? (
          <>
            <span
              className="identity-pill signed-in"
              title={shortId(identityId)}
            >
              Signed in
            </span>
            <button
              type="button"
              className="topbar-auth-button"
              onClick={onLogout}
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            type="button"
            className="identity-pill"
            onClick={onLoginClick}
            disabled={status === "connecting"}
          >
            {status === "connecting" ? "Connecting..." : "Sign in"}
          </button>
        )}
      </div>
    </div>
  );
}
