import { useState, type ReactNode } from "react";

import { useTheme } from "../hooks/useTheme";
import type { SessionStatus } from "../session/SessionContext";
import { IdentityCard } from "./IdentityCard";
import { NavButton } from "./NavButton";
import type { TopTab } from "./Tabs";

interface AppShellProps {
  tab: TopTab;
  onTabChange: (tab: TopTab) => void;
  status: SessionStatus;
  identityId: string | null;
  dpnsName: string | null;
  contractId: string | null;
  onLoginOpen: () => void;
  onOpenActivity?: () => void;
  children: ReactNode;
  mobileFullBleed?: boolean;
}

function LogoAvatar() {
  return (
    <div
      className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[9px] border border-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
      style={{
        background:
          "linear-gradient(135deg, oklch(94% 0.04 95), oklch(88% 0.05 85))",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="oklch(35% 0.05 65)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
        <path d="M9 9h1M9 13h6M9 17h6" />
      </svg>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
    >
      {isDark ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

export function AppShell({
  tab,
  onTabChange,
  status,
  identityId,
  dpnsName,
  contractId,
  onLoginOpen,
  onOpenActivity,
  children,
  mobileFullBleed = false,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  const nav = (
    <nav className="flex flex-col gap-0.5">
      <NavButton
        label="Notes"
        glyph="✎"
        active={tab === "notes"}
        onClick={() => {
          onTabChange("notes");
          closeDrawer();
        }}
      />
      <NavButton
        label="How it works"
        glyph="i"
        active={tab === "how-it-works"}
        onClick={() => {
          onTabChange("how-it-works");
          closeDrawer();
        }}
      />
      <NavButton
        label="Settings"
        glyph="⚙"
        active={tab === "settings"}
        onClick={() => {
          onTabChange("settings");
          closeDrawer();
        }}
      />
      {onOpenActivity && (
        <div className="md:hidden">
          <NavButton
            label="Activity"
            glyph="⌁"
            active={false}
            onClick={() => {
              onOpenActivity();
              closeDrawer();
            }}
          />
        </div>
      )}
      {status !== "authenticated" && status !== "browsing" && (
        <NavButton
          label="Sign in"
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
    <div className="min-h-screen md:grid md:grid-cols-[228px_1fr]">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/95 px-3.5 py-2.5 backdrop-blur md:hidden">
        <div className="flex items-center gap-2.5">
          <LogoAvatar />
          <div className="text-[13px] font-semibold text-ink">Dashnote</div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            title={drawerOpen ? "Close menu" : "Open menu"}
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
      </div>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-[228px] flex-col gap-6 overflow-y-auto border-r border-line bg-bg px-4 py-5 transition-transform duration-200 ease-out md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "max-md:-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3">
          <LogoAvatar />
          <div>
            <div className="text-[13px] font-semibold text-ink">Dashnote</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
              Duly Noted
            </div>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        {nav}

        <div className="rounded-2xl border border-line bg-surface px-4 py-4 text-[12px] leading-5 text-ink-3 shadow-[0_12px_40px_-28px_rgba(0,0,0,0.45)]">
          Notes are mutable documents on Dash Platform. Dashnote shows the
          current note state plus created, updated, and revision metadata.
        </div>

        <div className="mt-auto">
          <IdentityCard
            status={status}
            identityId={identityId}
            dpnsName={dpnsName}
            contractId={contractId}
            onLoginClick={() => {
              onLoginOpen();
              closeDrawer();
            }}
            onOpenSettings={() => {
              onTabChange("settings");
              closeDrawer();
            }}
          />
        </div>
      </aside>

      <main
        className={`min-w-0 md:px-7 md:py-7 ${
          mobileFullBleed
            ? "max-md:flex max-md:min-h-[calc(100dvh-49px)] max-md:flex-col max-md:bg-surface max-md:p-0"
            : "px-4 py-5"
        }`}
      >
        <div
          className={`mx-auto max-w-[1240px] ${
            mobileFullBleed
              ? "max-md:flex max-md:min-h-0 max-md:w-full max-md:max-w-none max-md:flex-1 max-md:flex-col"
              : ""
          }`}
        >
          {children}
        </div>
        <footer
          className={`mx-auto mt-10 flex max-w-[1240px] justify-center border-t border-line pt-4 text-[12px] text-ink-3 ${
            mobileFullBleed ? "max-md:hidden" : ""
          }`}
        >
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
