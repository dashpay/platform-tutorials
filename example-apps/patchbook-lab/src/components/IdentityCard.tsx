import type { SessionStatus } from "../session/SessionContext";
import { truncateId } from "../lib/format";

interface IdentityCardProps {
  status: SessionStatus;
  identityId: string | null;
  contractId: string | null;
  onLoginClick: () => void;
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
  contractId,
  onLoginClick,
}: IdentityCardProps) {
  const isAuthed = status === "authenticated";
  const isConnected = status === "readonly" || isAuthed;

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
              ? "Connecting..."
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
              Settings
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-5 w-5 shrink-0 rounded-full"
              style={{ background: avatarGradient(identityId) }}
            />
            <div className="min-w-0">
              <div className="truncate text-[12px] font-medium text-ink transition-colors group-hover:text-accent">
                {identityId ? truncateId(identityId, 6) : "Identity"}
              </div>
              <div className="truncate font-mono text-[10px] text-ink-4">
                {contractId
                  ? `contract ${truncateId(contractId, 6)}`
                  : "No contract"}
              </div>
            </div>
          </div>
        </>
      )}

      <div className={`flex items-center gap-1.5 ${isAuthed ? "mt-2.5" : ""}`}>
        <span className="conn-dot connected" />
        <span className="font-mono text-[10.5px] text-ink-3">
          {isAuthed ? "Authenticated" : "Connected"}
        </span>
      </div>
    </button>
  );
}
