import { useEffect, useRef } from "react";

import { shortId } from "../lib/format";
import type { SessionStatus } from "../session/SessionContext";

export type View =
  "overview" | "operations" | "pending" | "governance" | "settings";

const TABS: { id: View; label: string }[] = [
  { id: "overview", label: "Dashboard" },
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
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView?.({
      block: "nearest",
      inline: "center",
    });
  }, [view]);

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
            ref={view === tab.id ? activeTabRef : undefined}
            className={view === tab.id ? "active" : ""}
            onClick={() => onViewChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="topbar-auth">
        {isAuthenticated ? (
          <button
            type="button"
            className="topbar-auth-button"
            onClick={onLogout}
            title={`Signed in as ${shortId(identityId)}`}
          >
            Sign out
          </button>
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
