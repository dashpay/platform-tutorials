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

        {view === "overview" && <OverviewView key={refreshKey} />}
        {view === "operations" && (
          <OperationsView onComplete={() => setRefreshKey((v) => v + 1)} />
        )}
        {view === "pending" && <PendingActionsView key={refreshKey} />}
        {view === "governance" && <GovernanceView key={refreshKey} />}
        {view === "account" && <AccountView />}
      </div>
      <footer className="app-footer">
        <a
          href="https://github.com/dashpay/platform-tutorials"
          target="_blank"
          rel="noreferrer"
        >
          View on GitHub
        </a>
      </footer>
    </main>
  );
}
