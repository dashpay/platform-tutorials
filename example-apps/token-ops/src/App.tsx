import { useEffect, useState } from "react";
import { Toaster } from "sonner";

import { AccountView } from "./components/AccountView";
import { AppNotices } from "./components/AppNotices";
import { GovernanceView } from "./components/GovernanceView";
import { OperationsView } from "./components/OperationsView";
import { OverviewView } from "./components/OverviewView";
import { PendingActionsView } from "./components/PendingActionsView";
import { TopNav, type View } from "./components/TopNav";
import { useSession } from "./session/useSession";

export default function App() {
  const session = useSession();
  const [view, setView] = useState<View>("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const [watchedIdentityIds, setWatchedIdentityIds] = useState<string[]>([]);

  useEffect(() => {
    if (session.status === "idle") void session.enterReadOnly();
  }, [session]);

  return (
    <main className="shell">
      <Toaster position="bottom-center" richColors />
      <TopNav
        view={view}
        onViewChange={setView}
        status={session.status}
        identityId={session.identityId}
      />
      <div className="content" style={{ padding: "1.5rem" }}>
        <AppNotices
          error={session.error}
          hasContract={Boolean(session.contractId)}
        />

        {view === "overview" && (
          <OverviewView
            key={refreshKey}
            watchedIdentityIds={watchedIdentityIds}
            onWatchIdentity={(identityId) =>
              setWatchedIdentityIds((previous) =>
                previous.includes(identityId) ? previous : [...previous, identityId],
              )
            }
            onNavigateToPending={() => setView("pending")}
          />
        )}
        {view === "operations" && (
          <OperationsView onComplete={() => setRefreshKey((v) => v + 1)} />
        )}
        {view === "pending" && <PendingActionsView key={refreshKey} />}
        {view === "governance" && <GovernanceView key={refreshKey} />}
        {view === "account" && <AccountView />}
      </div>
      <footer className="app-footer">
        <a
          href="https://github.com/dashpay/platform-tutorials/tree/main/example-apps/token-ops"
          target="_blank"
          rel="noreferrer"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          View source
        </a>
      </footer>
    </main>
  );
}
