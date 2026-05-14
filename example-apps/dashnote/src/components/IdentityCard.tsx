import { useEffect, useRef, useState } from "react";

import type { SessionStatus } from "../session/SessionContext";
import { truncateId } from "../lib/format";
import { useSession } from "../session/useSession";

interface IdentityCardProps {
  status: SessionStatus;
  identityId: string | null;
  dpnsName: string | null;
  contractId: string | null;
  onLoginClick: () => void;
  onOpenSettings: () => void;
}

function avatarGradient(seed: string | null): string {
  if (!seed) {
    return "conic-gradient(from 0deg, oklch(40% 0.02 260), oklch(30% 0.02 260))";
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * 37) % 360;
  }
  return `conic-gradient(from ${hash}deg, oklch(65% 0.15 ${hash}), oklch(50% 0.12 ${(hash + 120) % 360}), oklch(65% 0.15 ${hash}))`;
}

export function IdentityCard({
  status,
  identityId,
  dpnsName,
  contractId,
  onLoginClick,
  onOpenSettings,
}: IdentityCardProps) {
  const session = useSession();
  const isAuthed = status === "authenticated";
  const isBrowsing = status === "browsing";
  const isReadonly = status === "readonly";
  const isConnected = isReadonly || isAuthed || isBrowsing;
  const hasIdentity = isAuthed || isBrowsing;
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!isConnected) {
    return (
      <div className="border-t border-line pt-3.5">
        <button
          type="button"
          onClick={onLoginClick}
          className="w-full rounded-md bg-accent px-3 py-2 text-[12px] font-semibold text-bg transition hover:bg-accent-dim"
        >
          Sign in
        </button>
        <div className="mt-2.5 flex items-center gap-1.5">
          <span
            className={`conn-dot ${
              status === "connecting"
                ? "connecting"
                : status === "error"
                  ? "error"
                  : ""
            }`}
          />
          <span className="font-mono text-[10.5px] text-ink-3">
            {status === "connecting"
              ? "Connecting..."
              : status === "error"
                ? "Error"
                : "Offline"}
          </span>
        </div>
      </div>
    );
  }

  // Read-only mode has nothing to put in a menu (no identity → no Settings
  // target, no Login/Switch entry, no Log out), so the card goes straight
  // to the login modal on click — matching the pre-menu behavior.
  if (isReadonly) {
    return (
      <button
        type="button"
        onClick={onLoginClick}
        className="group w-full border-t border-line pt-3.5 text-left"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
            Connected
          </span>
          <span className="text-[10px] text-ink-4 opacity-0 transition-opacity group-hover:opacity-100">
            Sign in
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="conn-dot connected" />
          <span className="font-mono text-[10.5px] text-ink-3">Connected</span>
        </div>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="group w-full border-t border-line pt-3.5 text-left"
      >
        {hasIdentity && (
          <>
            <div className="mb-0.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                {isAuthed ? "Signed in" : "Read-only"}
              </span>
              <span className="text-[10px] text-ink-4 opacity-0 transition-opacity group-hover:opacity-100">
                Menu
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-5 w-5 shrink-0 rounded-full"
                style={{ background: avatarGradient(identityId) }}
              />
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium text-ink transition-colors group-hover:text-accent">
                  {dpnsName
                    ? `@${dpnsName}`
                    : identityId
                      ? truncateId(identityId, 6)
                      : "Identity"}
                </div>
                <div className="truncate font-mono text-[10px] text-ink-4">
                  {dpnsName && identityId
                    ? truncateId(identityId, 6)
                    : contractId
                      ? `contract ${truncateId(contractId, 6)}`
                      : "No contract"}
                </div>
              </div>
            </div>
          </>
        )}

        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="conn-dot connected" />
          <span className="font-mono text-[10.5px] text-ink-3">
            {isAuthed ? "Authenticated" : "Browsing (read-only)"}
          </span>
        </div>
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute bottom-full left-0 right-0 z-40 mb-2 flex flex-col gap-0.5 rounded-md border border-line bg-surface p-1 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.6)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onOpenSettings();
            }}
            className="rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-ink-2 transition hover:bg-surface-2 hover:text-ink"
          >
            Settings
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onLoginClick();
            }}
            className="rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-ink-2 transition hover:bg-surface-2 hover:text-ink"
          >
            {isAuthed ? "Switch identity" : "Sign in"}
          </button>
          {isAuthed && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                session.logout();
              }}
              className="rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-ink-2 transition hover:bg-surface-2 hover:text-ink"
            >
              Log out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
