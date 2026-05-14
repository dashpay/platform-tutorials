import { useEffect } from "react";

import { formatRelativeTime } from "../lib/format";
import { useSession } from "../session/useSession";

interface ActivityPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ActivityPanel({ open, onClose }: ActivityPanelProps) {
  const { activityLog, clearActivityLog } = useSession();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Activity log"
      className="fixed inset-0 z-40 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[440px] flex-col border-l border-line bg-surface shadow-[0_30px_70px_-22px_rgba(0,0,0,0.7)]"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="text-accent"
              aria-hidden
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <div className="text-[13px] font-semibold text-ink">Activity</div>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-ink-4">
              live
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearActivityLog}
              className="rounded-md border border-line px-2 py-1 text-[11px] text-ink-3 hover:border-line-2 hover:text-ink"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-ink-4 hover:text-ink"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activityLog.length === 0 ? (
            <div className="px-5 py-8 text-center text-[12.5px] text-ink-4">
              No activity yet. Save a note to see SDK calls land here.
            </div>
          ) : (
            activityLog.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[10px_1fr_auto] items-center gap-3 px-5 py-2.5 hover:bg-bg/30"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    entry.level === "success"
                      ? "bg-[oklch(70%_0.16_150)]"
                      : entry.level === "error"
                        ? "bg-[color:var(--color-danger)]"
                        : "bg-ink-4"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] text-ink">
                    {entry.message}
                  </div>
                  {entry.detail && (
                    <div className="truncate font-mono text-[11px] text-ink-4">
                      {entry.detail}
                    </div>
                  )}
                </div>
                <div className="font-mono text-[10.5px] text-ink-4">
                  {formatRelativeTime(entry.timestamp)}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
