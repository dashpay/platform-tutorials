import { useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";

import { AppShell } from "./components/AppShell";
import { AnchorForm } from "./components/AnchorForm";
import { ExampleFilesModal } from "./components/ExampleFilesModal";
import { HistoryPanel } from "./components/HistoryPanel";
import { HowItWorks } from "./components/HowItWorks";
import { LoginModal } from "./components/LoginModal";
import { OperationResultNotice } from "./components/OperationResultNotice";
import { VerifyPanel } from "./components/VerifyPanel";
import type { TopTab } from "./components/Tabs";
import { useSession } from "./session/useSession";

const screenCopy: Record<TopTab, { title: string; subtitle: string }> = {
  anchor: {
    title: "Create a proof for a local file",
    subtitle: "We compute a SHA-256 hash and anchor it on Dash Platform.",
  },
  verify: {
    title: "Verify proof",
    subtitle: "Verify the selected file against proofs on Dash Platform.",
  },
  history: {
    title: "Review proof history",
    subtitle:
      "Inspect your own anchors or load a full chain timeline by chainId.",
  },
  "how-it-works": {
    title: "How it works",
    subtitle:
      "Understand the proof flow, Platform operations, and code structure behind DashProof Lab.",
  },
};

function App() {
  const session = useSession();
  const { status, enterReadOnly } = session;
  const [tab, setTab] = useState<TopTab>("anchor");
  const [loginOpen, setLoginOpen] = useState(false);
  const [starterFilesOpen, setStarterFilesOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [historyChainId, setHistoryChainId] = useState<string | null>(null);
  const [historyRequestToken, setHistoryRequestToken] = useState(0);

  useEffect(() => {
    if (status === "idle") void enterReadOnly();
  }, [status, enterReadOnly]);

  const header = useMemo(() => screenCopy[tab], [tab]);

  function openHistoryForChain(chainId: string) {
    setHistoryChainId(chainId);
    setHistoryRequestToken((value) => value + 1);
    setTab("history");
  }

  return (
    <>
      <Toaster position="bottom-center" />
      <AppShell
        tab={tab}
        onTabChange={setTab}
        status={session.status}
        identityId={session.identityId}
        contractId={session.contractId}
        onLoginOpen={() => setLoginOpen(true)}
      >
        <header className="rounded-lg border border-line bg-surface px-5 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                Dash Platform Proof of Existence
              </div>
              <h1 className="mt-2 text-[22px] font-semibold leading-[1.15] tracking-tight text-ink">
                {header.title}
              </h1>
              <p className="mt-1 max-w-[720px] text-[12.5px] text-ink-3">
                {header.subtitle}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
              <button
                type="button"
                onClick={() => setStarterFilesOpen(true)}
                className="rounded-md border border-line-2 bg-transparent px-3 py-2 text-[12px] font-semibold text-ink-2 transition hover:border-accent-dim hover:text-ink"
              >
                Starter files
              </button>
              <div className="text-[11px] leading-5 text-ink-4 md:max-w-[240px] md:text-right">
                Open the repo fixtures only when you need a known file, chain
                ID, or SHA-256 reference.
              </div>
            </div>
          </div>
        </header>

        <div className="mt-6">
          {session.error && (
            <div className="mb-6">
              <OperationResultNotice tone="error" title="Session error">
                {session.error}
              </OperationResultNotice>
            </div>
          )}

          {tab === "anchor" && (
            <AnchorForm
              contractId={session.contractId}
              onLoginPrompt={() => setLoginOpen(true)}
              onAnchored={() => setRefreshKey((value) => value + 1)}
            />
          )}
          {tab === "verify" && (
            <VerifyPanel
              contractId={session.contractId}
              onViewChainHistory={openHistoryForChain}
            />
          )}
          {tab === "history" && (
            <HistoryPanel
              contractId={session.contractId}
              refreshKey={refreshKey}
              requestedChainId={historyChainId}
              requestToken={historyRequestToken}
            />
          )}
          {tab === "how-it-works" && <HowItWorks />}
        </div>
      </AppShell>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <ExampleFilesModal
        open={starterFilesOpen}
        onClose={() => setStarterFilesOpen(false)}
      />
    </>
  );
}

export default App;
