/**
 * Two-column app shell: 208px fixed left nav + fluid main column.
 * Replaces the old top-header + centered-max-width layout.
 */
import { useState, type ReactNode } from "react";
import type { TopTab } from "./Tabs";
import type { SessionStatus } from "../session/SessionContext";
import type { DashSdk } from "../dash/types";
import { NavButton } from "./NavButton";
import { IdentityCard } from "./IdentityCard";

interface AppShellProps {
  tab: TopTab;
  onTabChange: (t: TopTab) => void;
  status: SessionStatus;
  identityId: string | null;
  sdk: DashSdk | null;
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
        <footer className="mx-auto mt-10 flex max-w-[1310px] justify-center border-t border-line pt-4 text-[12px] text-ink-3">
          <a
            href="https://github.com/dashpay/platform-tutorials"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-ink-3 hover:text-accent"
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
            View on GitHub
          </a>
        </footer>
      </main>
    </div>
  );
}
