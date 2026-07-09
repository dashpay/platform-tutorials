import { shortId } from "../lib/format";
import type { SessionStatus } from "../session/SessionContext";

export type View =
  "overview" | "operations" | "pending" | "governance" | "account";

const TABS: { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "operations", label: "Operations" },
  { id: "pending", label: "Pending" },
  { id: "governance", label: "Governance" },
  { id: "account", label: "Account" },
];

export function TopNav({
  view,
  onViewChange,
  status,
  identityId,
}: {
  view: View;
  onViewChange: (view: View) => void;
  status: SessionStatus;
  identityId: string | null;
}) {
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
      <span
        className={`identity-pill ${
          status === "authenticated" && identityId ? "signed-in" : ""
        }`}
        title={
          status === "authenticated" && identityId
            ? shortId(identityId)
            : undefined
        }
      >
        {status === "authenticated" && identityId
          ? "Signed in"
          : status === "connecting"
            ? "Connecting..."
            : "Read-only"}
      </span>
    </div>
  );
}
