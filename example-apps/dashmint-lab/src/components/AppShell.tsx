/**
 * Two-column app shell: 208px fixed left nav + fluid main column.
 * Replaces the old top-header + centered-max-width layout.
 */
import { useState, type ReactNode } from "react";
import type { TopTab } from "./Tabs";
import type { SessionStatus } from "../session/SessionContext";
import { NavButton } from "./NavButton";
import { IdentityCard } from "./IdentityCard";

interface AppShellProps {
  tab: TopTab;
  onTabChange: (t: TopTab) => void;
  status: SessionStatus;
  identityId: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdk: any | null;
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
  sdk,
  onLoginOpen,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  const nav = (
    <nav className="flex flex-col gap-0.5">
      <NavButton
        label="Collection"
        glyph="▤"
        active={tab === "collection"}
        onClick={() => {
          onTabChange("collection");
          closeDrawer();
        }}
      />
      <NavButton
        label="Mint"
        glyph="✦"
        active={tab === "mint"}
        onClick={() => {
          onTabChange("mint");
          closeDrawer();
        }}
      />
      <NavButton
        label="How it works"
        glyph="?"
        active={tab === "how-it-works"}
        onClick={() => {
          onTabChange("how-it-works");
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
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg px-3.5 py-2.5 md:hidden">
        <div className="flex items-center gap-2.5">
          <LogoAvatar />
          <div className="text-[13px] font-semibold text-ink">DashMint Lab</div>
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

      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* Sidebar / drawer */}
      <aside
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-[208px] flex-col gap-[22px] overflow-y-auto border-r border-line bg-bg px-3.5 py-[18px] transition-transform duration-200 ease-out md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "max-md:-translate-x-full"
        }`}
      >
        {/* Logo + title */}
        <div className="flex items-center gap-2.5">
          <LogoAvatar />
          <div>
            <div className="text-[13px] font-semibold text-ink">
              DashMint Lab
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
              Testnet
            </div>
          </div>
        </div>

        {/* Navigation */}
        {nav}

        {/* Spacer + identity card at bottom */}
        <div className="mt-auto">
          <IdentityCard
            status={status}
            identityId={identityId}
            sdk={sdk}
            onLoginClick={() => {
              onLoginOpen();
              closeDrawer();
            }}
          />
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 px-4 py-[22px] md:px-7">
        <div className="mx-auto max-w-[1310px]">{children}</div>
      </main>
    </div>
  );
}
