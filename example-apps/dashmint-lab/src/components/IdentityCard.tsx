/**
 * Identity display at the bottom of the left nav.
 * Shows conic-gradient avatar, DPNS name, and connection sync status.
 * When not authenticated, shows a Login button instead.
 */
import type { SessionStatus } from "../session/SessionContext";
import type { DashSdk } from "../dash/types";
import { useDpnsName } from "../hooks/useDpnsName";
import { truncateId } from "../lib/format";

interface IdentityCardProps {
  status: SessionStatus;
  identityId: string | null;
  sdk: DashSdk | null;
  onLoginClick: () => void;
}

function avatarGradient(seed: string | null): string {
  if (!seed)
    return "conic-gradient(from 0deg, oklch(40% 0.02 260), oklch(30% 0.02 260))";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * 37) % 360;
  return `conic-gradient(from ${h}deg, oklch(65% 0.15 ${h}), oklch(50% 0.12 ${(h + 120) % 360}), oklch(65% 0.15 ${h}))`;
}

export function IdentityCard({
  status,
  identityId,
  sdk,
  onLoginClick,
}: IdentityCardProps) {
  const dpnsName = useDpnsName(sdk, identityId);

  const isAuthed = status === "authenticated";
  const isConnected = status === "browsing" || isAuthed;

  if (!isConnected) {
    return (
      <div className="border-t border-line pt-3.5">
        <button
          type="button"
          onClick={onLoginClick}
          className="w-full rounded-md bg-accent px-3 py-2 text-[12px] font-semibold text-bg transition hover:bg-accent-dim"
        >
          Login
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
              ? "Connecting…"
              : status === "error"
                ? "Error"
                : "Offline"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onLoginClick}
      className="group w-full border-t border-line pt-3.5 text-left"
    >
      {isAuthed && (
        <>
          <div className="mb-0.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              Signed in
            </span>
            <span className="text-[10px] text-ink-4 opacity-0 transition-opacity group-hover:opacity-100">
              ⚙
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-5 w-5 shrink-0 rounded-full"
              style={{ background: avatarGradient(identityId) }}
            />
            <div className="min-w-0">
              <div className="truncate text-[12px] font-medium text-ink transition-colors group-hover:text-accent">
                {dpnsName ? `@${dpnsName}` : "Identity"}
              </div>
              {identityId && (
                <div className="truncate font-mono text-[10px] text-ink-4">
                  {truncateId(identityId, 6)}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className={`flex items-center gap-1.5 ${isAuthed ? "mt-2.5" : ""}`}>
        <span className="conn-dot connected" />
        <span className="font-mono text-[10.5px] text-ink-3">Connected</span>
      </div>
    </button>
  );
}
