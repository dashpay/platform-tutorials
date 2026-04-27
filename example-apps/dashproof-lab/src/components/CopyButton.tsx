import { useState, type MouseEvent } from "react";

interface CopyButtonProps {
  value: string;
  label?: string;
  onCopied?: (label: string) => void;
}

function copyText(text: string): void {
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text).catch(() => {
      /* fallback below isn't reachable in modern browsers */
    });
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    // ignore
  }
  document.body.removeChild(ta);
}

export function CopyButton({
  value,
  label = "Copy",
  onCopied,
}: CopyButtonProps) {
  const [done, setDone] = useState(false);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    copyText(value);
    setDone(true);
    onCopied?.(label);
    window.setTimeout(() => setDone(false), 1200);
  }

  return (
    <button
      type="button"
      title={`Copy ${label.toLowerCase()}`}
      aria-label={`Copy ${label.toLowerCase()}`}
      onClick={handleClick}
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border border-transparent transition ${
        done
          ? "text-[oklch(72%_0.14_150)]"
          : "text-ink-4 hover:bg-surface-2 hover:text-ink-2"
      }`}
    >
      {done ? (
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8.5l3.2 3 6.8-7" />
        </svg>
      ) : (
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="5" y="5" width="9" height="9" rx="1.6" />
          <path d="M3.5 11V3.5A1.5 1.5 0 0 1 5 2h6.5" />
        </svg>
      )}
    </button>
  );
}
