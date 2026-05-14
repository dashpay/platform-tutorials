import type { ReactNode } from "react";

interface NotesToolbarProps {
  title: string;
  onOpenActivity?: () => void;
  rightSlot?: ReactNode;
}

/**
 * Slim page-title row used on the notes tab in place of the heavy
 * header card. Settings + How-it-works keep the card pattern.
 */
export function NotesToolbar({
  title,
  onOpenActivity,
  rightSlot,
}: NotesToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-2 max-md:hidden">
      <div className="flex items-center gap-2.5">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">
          {title}
        </h1>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-4">
          testnet
        </span>
      </div>
      <div className="flex items-center gap-2">
        {onOpenActivity && (
          <button
            type="button"
            onClick={onOpenActivity}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-3 hover:border-line-2 hover:text-ink"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            Activity
            <span className="rounded border border-line bg-bg px-1 font-mono text-[9px] text-ink-4">
              ⌘L
            </span>
          </button>
        )}
        {rightSlot}
      </div>
    </div>
  );
}
