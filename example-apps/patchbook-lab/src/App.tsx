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
  const { status, sdk, enterReadOnly, viewAsRemembered } = session;
  const [tab, setTab] = useState<TopTab>("notes");
  const [loginOpen, setLoginOpen] = useState(false);

  const mobileFullBleed = tab === "notes";

  useEffect(() => {
    if (status === "idle") void enterReadOnly();
    else if (status === "browsing" && !sdk) void viewAsRemembered();
  }, [enterReadOnly, viewAsRemembered, status, sdk]);

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
        mobileFullBleed={mobileFullBleed}
      >
        <header
          className={`rounded-[28px] border border-line bg-surface px-5 py-5 shadow-[0_20px_60px_-36px_rgba(0,0,0,0.45)] max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:px-4 max-md:py-4 max-md:shadow-none ${
            tab === "notes" &&
            (status === "authenticated" || status === "browsing")
              ? "max-md:hidden"
              : ""
          }`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-4">
            Dash Platform Notes Tutorial
          </div>
          <h1 className="mt-2 text-[28px] font-semibold leading-[1.05] tracking-tight text-ink">
            {header.title}
          </h1>
          <p className="mt-2 max-w-[760px] text-[13px] leading-6 text-ink-3">
            {header.subtitle}
          </p>
        </header>

        <div
          className={`${
            tab === "notes" &&
            (status === "authenticated" || status === "browsing")
              ? "mt-6 max-md:mt-0"
              : "mt-6"
          } ${mobileFullBleed ? "max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col" : ""}`}
        >
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
