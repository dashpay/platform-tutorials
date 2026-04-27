import { useState, type ReactNode } from "react";

import type { SessionStatus } from "../session/SessionContext";
import { IdentityCard } from "./IdentityCard";
import { NavButton } from "./NavButton";
import type { TopTab } from "./Tabs";

interface AppShellProps {
  tab: TopTab;
  onTabChange: (tab: TopTab) => void;
  status: SessionStatus;
  identityId: string | null;
  contractId: string | null;
  onLoginOpen: () => void;
  children: ReactNode;
}

function LogoAvatar() {
  return (
    <div
      className="h-[26px] w-[26px] shrink-0 rounded-[7px]"
      style={{
        background:
          "conic-gradient(from 30deg, oklch(74% 0.16 55), oklch(60% 0.14 30), oklch(74% 0.16 55))",
      }}
    />
  );
}

export function AppShell({
  tab,
  onTabChange,
  status,
  identityId,
  contractId,
  onLoginOpen,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  const nav = (
    <nav className="flex flex-col gap-0.5">
      <NavButton
        label="Create proof"
        glyph="#"
        active={tab === "anchor"}
        onClick={() => {
          onTabChange("anchor");
          closeDrawer();
        }}
      />
      <NavButton
        label="Verify proof"
        glyph="?"
        active={tab === "verify"}
        onClick={() => {
          onTabChange("verify");
          closeDrawer();
        }}
      />
      <NavButton
        label="History"
        glyph="↺"
        active={tab === "history"}
        onClick={() => {
          onTabChange("history");
          closeDrawer();
        }}
      />
      {status !== "authenticated" && (
        <NavButton
          label="Login"
          glyph="→"
          active={false}
          onClick={() => {
            onLoginOpen();
            closeDrawer();
          }}
        />
      )}
    </nav>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[208px_1fr]">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg px-3.5 py-2.5 md:hidden">
        <div className="flex items-center gap-2.5">
          <LogoAvatar />
          <div className="text-[13px] font-semibold text-ink">
            DashProof Lab
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(!drawerOpen)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:text-ink"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-[208px] flex-col gap-[22px] overflow-y-auto border-r border-line bg-bg px-3.5 py-[18px] transition-transform duration-200 ease-out md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "max-md:-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <LogoAvatar />
          <div>
            <div className="text-[13px] font-semibold text-ink">
              DashProof Lab
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
              Testnet
            </div>
          </div>
        </div>

        {nav}

        <div className="rounded-lg border border-line bg-surface px-3 py-3 text-[12px] leading-5 text-ink-3">
          Files stay local. The app stores only the SHA-256 hash, optional
          metadata, and the Platform timestamp.
        </div>

        <div className="mt-auto">
          <IdentityCard
            status={status}
            identityId={identityId}
            contractId={contractId}
            onLoginClick={() => {
              onLoginOpen();
              closeDrawer();
            }}
          />
        </div>
      </aside>

      <main className="min-w-0 px-4 py-[22px] md:px-7">
        <div className="mx-auto max-w-[1160px]">{children}</div>
      </main>
    </div>
  );
}
