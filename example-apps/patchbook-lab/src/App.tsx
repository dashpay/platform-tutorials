import { useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";

import { AppShell } from "./components/AppShell";
import { HowItWorks } from "./components/HowItWorks";
import { LoginModal } from "./components/LoginModal";
import { NotesWorkspace } from "./components/NotesWorkspace";
import { OperationResultNotice } from "./components/OperationResultNotice";
import type { TopTab } from "./components/Tabs";
import { useSession } from "./session/useSession";

const screenCopy: Record<TopTab, { title: string; subtitle: string }> = {
  notes: {
    title: "Personal notes on Dash Platform",
    subtitle:
      "Create, edit, and review note metadata with a simple two-pane notebook UI.",
  },
  "how-it-works": {
    title: "How Patchbook works",
    subtitle:
      "See how the note contract, mutation helpers, and notebook UI line up with the tutorials.",
  },
};

function App() {
  const session = useSession();
  const { status, enterReadOnly } = session;
  const [tab, setTab] = useState<TopTab>("notes");
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (status === "idle") void enterReadOnly();
  }, [enterReadOnly, status]);

  const header = useMemo(() => screenCopy[tab], [tab]);

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
        <header className="rounded-[28px] border border-line bg-surface px-5 py-5 shadow-[0_20px_60px_-36px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                Dash Platform Notes Tutorial
              </div>
              <h1 className="mt-2 text-[28px] font-semibold leading-[1.05] tracking-tight text-ink">
                {header.title}
              </h1>
              <p className="mt-2 max-w-[760px] text-[13px] leading-6 text-ink-3">
                {header.subtitle}
              </p>
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

          {tab === "notes" && (
            <NotesWorkspace onOpenSettings={() => setLoginOpen(true)} />
          )}
          {tab === "how-it-works" && <HowItWorks />}
        </div>
      </AppShell>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}

export default App;
